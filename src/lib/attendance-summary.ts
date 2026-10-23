import { jstDayRange, toJstDateValue } from "@/lib/time";

// 月次の勤怠集計の判定ロジック(純粋な関数。DBに触れないのでテストできる)。
// 判定基準(カワジャン氏と確定):
//  出勤日数      = 出勤・退勤の両方が打刻された日(JSTの暦日)
//  打刻漏れ      = 出勤か退勤のどちらか片方だけの日(当日は除く)
//  定時超過打刻  = シフトの開始時刻を過ぎて出勤打刻した日(分単位で比較。シフトに紐づく出勤打刻のみ判定)
//  欠勤          = シフトがあるのに、その日に出勤打刻がない日(キャンセル済みシフトは除く。当日は除く)
//  早退          = スタッフから早退報告(イレギュラー報告の「早退」/簡易モードの「早退」)があった日のみ

export type ClockInput = { type: "IN" | "OUT"; timestamp: Date; shiftId: string | null };
export type ShiftInput = { id: string; startTime: Date };

export type AttendanceCounts = {
  workDays: number;
  missedClockDates: string[];
  lateClockInDates: string[];
  absenceDates: string[];
  earlyLeaveDates: string[];
};

const minuteOf = (d: Date) => Math.floor(d.getTime() / 60000);

// 純粋な関数(DBに触れない)。テストできる。
export function summarizeAttendance(input: {
  shifts: ShiftInput[]; // キャンセル済みを除いたシフト
  clocks: ClockInput[];
  earlyLeaveDates: string[]; // 早退報告があった日(YYYY-MM-DD)
  now: Date;
}): AttendanceCounts {
  const { shifts, clocks, earlyLeaveDates, now } = input;
  const todayKey = toJstDateValue(now);

  const byDate = new Map<string, { hasIn: boolean; hasOut: boolean }>();
  for (const c of clocks) {
    const key = toJstDateValue(c.timestamp);
    const e = byDate.get(key) ?? { hasIn: false, hasOut: false };
    if (c.type === "IN") e.hasIn = true;
    else e.hasOut = true;
    byDate.set(key, e);
  }

  let workDays = 0;
  const missedClockDates: string[] = [];
  for (const [key, e] of byDate) {
    if (e.hasIn && e.hasOut) workDays++;
    else if (key < todayKey) missedClockDates.push(key);
  }

  const lateClockInDates: string[] = [];
  const absenceDates: string[] = [];
  for (const s of shifts) {
    const dayKey = toJstDateValue(s.startTime);
    const ins = clocks.filter((c) => c.type === "IN" && c.shiftId === s.id);
    if (ins.length > 0) {
      const first = Math.min(...ins.map((c) => c.timestamp.getTime()));
      if (minuteOf(new Date(first)) > minuteOf(s.startTime)) lateClockInDates.push(dayKey);
      continue;
    }
    // 別のシフトに紐づいていなくても、その日に出勤打刻があれば欠勤にしない。
    if (byDate.get(dayKey)?.hasIn) continue;
    // 当日はまだ終わっていないので欠勤にしない。
    if (dayKey < todayKey && now >= jstDayRange(s.startTime).end) absenceDates.push(dayKey);
  }

  const sortUnique = (a: string[]) => [...new Set(a)].sort();
  return {
    workDays,
    missedClockDates: sortUnique(missedClockDates),
    lateClockInDates: sortUnique(lateClockInDates),
    absenceDates: sortUnique(absenceDates),
    earlyLeaveDates: sortUnique(earlyLeaveDates),
  };
}

