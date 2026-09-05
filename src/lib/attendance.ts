import { prisma } from "@/lib/prisma";
import { jstDayRange, toJstTimeValue } from "@/lib/time";

export type TodayShiftBucket = "clockedIn" | "notClockedIn" | "clockedOut";

export type TodayShiftEntry = {
  shiftId: string;
  staffName: string;
  storeName: string;
  scheduledStart: string; // "HH:mm"
  scheduledEnd: string; // "HH:mm"
  inTime: string | null;
  outTime: string | null;
  bucket: TodayShiftBucket | null; // null = シフト開始前でまだ判定対象外
};

export type TodayShiftStatusSummary = {
  scheduledCount: number;
  clockedIn: TodayShiftEntry[];
  notClockedIn: TodayShiftEntry[];
  clockedOut: TodayShiftEntry[];
};

// 管理者ホームの「今日の稼働状況」用。未出勤の判定は既存の未出勤アラート
// (src/app/api/cron/no-show-check/route.ts)と同じ条件
// (シフト開始時刻を過ぎてもIN打刻がない)を流用する。まだ開始時刻前の
// スタッフは「未出勤」に含めない(仕様)。
export async function getTodayShiftStatusSummary(now: Date = new Date()): Promise<TodayShiftStatusSummary> {
  const { start, end } = jstDayRange(now);
  const shifts = await prisma.shift.findMany({
    where: { cancelledAt: null, startTime: { gte: start, lt: end }, staff: { status: "ACTIVE" } },
    include: { staff: true, clockRecords: { orderBy: { timestamp: "asc" } } },
    orderBy: { startTime: "asc" },
  });

  const entries: TodayShiftEntry[] = shifts.map((s) => {
    const firstIn = s.clockRecords.find((r) => r.type === "IN");
    const lastOut = [...s.clockRecords].reverse().find((r) => r.type === "OUT");
    let bucket: TodayShiftBucket | null = null;
    if (lastOut) bucket = "clockedOut";
    else if (firstIn) bucket = "clockedIn";
    else if (s.startTime <= now) bucket = "notClockedIn";

    return {
      shiftId: s.id,
      staffName: s.staff.name,
      storeName: s.storeName,
      scheduledStart: toJstTimeValue(s.startTime),
      scheduledEnd: toJstTimeValue(s.endTime),
      inTime: firstIn ? toJstTimeValue(firstIn.timestamp) : null,
      outTime: lastOut ? toJstTimeValue(lastOut.timestamp) : null,
      bucket,
    };
  });

  const byBucket = (bucket: TodayShiftBucket) => entries.filter((e) => e.bucket === bucket);

  return {
    scheduledCount: new Set(shifts.map((s) => s.staffId)).size,
    clockedIn: byBucket("clockedIn"),
    notClockedIn: byBucket("notClockedIn"),
    clockedOut: byBucket("clockedOut"),
  };
}

export type AttendingMember = {
  id: string;
  name: string;
  storeName: string | null;
  inTime: string | null;
  inTimestamp: number;
};

// 本日、在籍中のスタッフのうち「最後の打刻がIN」のスタッフ(=現在出勤中)を
// 出勤時刻の早い順に返す。/town の出勤メンバー一覧と、ホーム画面の
// 「現在〇〇人出勤中」表示の両方で使う共通ロジック。
export async function getAttendingStaff(at: Date = new Date()): Promise<AttendingMember[]> {
  const { start, end } = jstDayRange(at);
  const records = await prisma.clockRecord.findMany({
    where: { timestamp: { gte: start, lt: end }, staff: { status: "ACTIVE" } },
    include: { staff: true },
    orderBy: { timestamp: "asc" },
  });

  const byStaff = new Map<string, typeof records>();
  for (const record of records) {
    byStaff.set(record.staffId, [...(byStaff.get(record.staffId) ?? []), record]);
  }

  return [...byStaff.values()]
    .filter((items) => items.at(-1)?.type === "IN")
    .map((items) => {
      const latest = items.at(-1)!;
      const firstIn = items.find((record) => record.type === "IN");
      return {
        id: latest.staff.id,
        name: latest.staff.name,
        storeName: latest.storeName,
        inTime: firstIn ? toJstTimeValue(firstIn.timestamp) : null,
        inTimestamp: firstIn?.timestamp.getTime() ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a.inTimestamp - b.inTimestamp || a.name.localeCompare(b.name, "ja"));
}
