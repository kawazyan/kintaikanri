import { prisma } from "@/lib/prisma";
import { computeMonthlyEarnings } from "@/lib/earnings";
import { fixedPaymentDateForClosingMonth } from "@/lib/payment";
import { jstMonthRange, toJstDateValue } from "@/lib/time";
import { summarizeAttendance, type AttendanceCounts } from "@/lib/attendance-summary";
import { fixedPaymentState, type FixedPaymentState } from "@/lib/fixed-payment-status";

// 管理画面「スタッフ管理」の月次サマリー用の集計(判定基準は attendance-summary.ts)。

export type StaffMonthSummary = AttendanceCounts & {
  staffId: string;
  earnings: number | null; // その月の受取金額(確定分)。null=計算できない
  expenses: number; // 申請のある経費(申請中+承認済)
  expensesPending: number; // うち承認待ち
  total: number | null; // earnings + expenses。earnings が null なら null
  paymentDate: Date | null; // 支払い予定日(固定支払のみ)
  paymentNote: string | null;
  paymentState: FixedPaymentState | null; // 固定支払(月末締め)のみ。振込完了ボタンの状態
  paidAmount: number | null; // 振込完了ボタンを押したときの金額
  paidAt: Date | null;
  requestedAmount: number; // 申請支払: 未払いの振込申請の合計
  requestedEarliestDate: Date | null; // 申請支払: 最も早い希望振込日
};

type StaffInput = {
  id: string;
  paymentMethod: "FIXED" | "REQUEST";
  fixedClosingDay: number | null;
  fixedPaymentMonthOffset: number | null;
  fixedPaymentDay: number | null;
};

// 月のタブ(YYYY-MM)で見る、全スタッフ分の集計。クエリはスタッフ数に関係なくまとめて取る。
export async function loadStaffMonthSummaries(staffList: StaffInput[], yearMonth: string, now: Date = new Date()): Promise<Map<string, StaffMonthSummary>> {
  const ids = staffList.map((s) => s.id);
  const { start, end } = jstMonthRange(yearMonth);

  const [shifts, clocks, irregular, simple, expenses, requests, completions] = await Promise.all([
    prisma.shift.findMany({ where: { staffId: { in: ids }, cancelledAt: null, startTime: { gte: start, lt: end } }, select: { id: true, staffId: true, startTime: true } }),
    prisma.clockRecord.findMany({ where: { staffId: { in: ids }, timestamp: { gte: start, lt: end } }, select: { staffId: true, type: true, timestamp: true, shiftId: true } }),
    prisma.irregularReport.findMany({ where: { staffId: { in: ids }, reportType: { in: ["EARLY_LEAVE", "ABSENCE", "SAME_DAY_ABSENCE"] }, targetDate: { gte: start, lt: end } }, select: { staffId: true, targetDate: true, reportType: true } }),
    prisma.simpleAttendanceEntry.findMany({ where: { staffId: { in: ids }, kind: { in: ["EARLY_LEAVE", "ABSENT"] }, date: { startsWith: yearMonth } }, select: { staffId: true, date: true, kind: true } }),
    prisma.expense.findMany({ where: { staffId: { in: ids }, yearMonth, status: { in: ["SUBMITTED", "APPROVED"] } }, select: { staffId: true, status: true, amountTaxInclusive: true } }),
    prisma.transferRequest.findMany({ where: { staffId: { in: ids }, status: "REQUESTING" }, select: { staffId: true, amount: true, desiredPaymentDate: true } }),
    prisma.fixedPaymentCompletion.findMany({ where: { staffId: { in: ids }, closingYearMonth: yearMonth }, select: { staffId: true, paidAmount: true, paidAt: true } }),
  ]);
  const completionByStaff = new Map(completions.map((c) => [c.staffId, c]));

  const group = <T extends { staffId: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) (m.get(r.staffId) ?? m.set(r.staffId, []).get(r.staffId)!).push(r);
    return m;
  };
  const gShifts = group(shifts), gClocks = group(clocks), gIrr = group(irregular), gSimple = group(simple), gExp = group(expenses), gReq = group(requests);

  const result = new Map<string, StaffMonthSummary>();
  for (const s of staffList) {
    const counts = summarizeAttendance({
      shifts: gShifts.get(s.id) ?? [],
      clocks: (gClocks.get(s.id) ?? []).map((c) => ({ type: c.type, timestamp: c.timestamp, shiftId: c.shiftId })),
      earlyLeaveDates: [
        ...(gIrr.get(s.id) ?? []).filter((r) => r.reportType === "EARLY_LEAVE").map((r) => toJstDateValue(r.targetDate)),
        ...(gSimple.get(s.id) ?? []).filter((r) => r.kind === "EARLY_LEAVE").map((r) => r.date),
      ],
      absenceDates: [
        ...(gIrr.get(s.id) ?? []).filter((r) => r.reportType !== "EARLY_LEAVE").map((r) => toJstDateValue(r.targetDate)),
        ...(gSimple.get(s.id) ?? []).filter((r) => r.kind === "ABSENT").map((r) => r.date),
      ],
      now,
    });

    const { confirmedAmount } = await computeMonthlyEarnings(s.id, yearMonth, now);
    const exps = gExp.get(s.id) ?? [];
    const expenseTotal = exps.reduce((sum, e) => sum + e.amountTaxInclusive, 0);
    const expensePending = exps.filter((e) => e.status === "SUBMITTED").reduce((sum, e) => sum + e.amountTaxInclusive, 0);

    const reqs = gReq.get(s.id) ?? [];
    let paymentDate: Date | null = null;
    let paymentNote: string | null = null;
    if (s.paymentMethod === "FIXED") {
      paymentDate = fixedPaymentDateForClosingMonth(s, yearMonth);
      if (!paymentDate) paymentNote = "支払日が未設定";
      else if (s.fixedClosingDay !== 0 && s.fixedClosingDay !== 31) paymentNote = "締日が月末以外のため、金額は暦月での集計(目安)";
    }
    // 振込完了ボタンの状態(固定支払で、月末締めのスタッフだけ。それ以外は管理対象外)
    const completion = completionByStaff.get(s.id) ?? null;
    const monthEndClosing = s.fixedClosingDay === 0 || s.fixedClosingDay === 31;
    const paymentState = s.paymentMethod === "FIXED" && paymentDate && monthEndClosing ? fixedPaymentState({ paymentDate, completed: !!completion, now }) : null;

    result.set(s.id, {
      ...counts,
      staffId: s.id,
      earnings: confirmedAmount,
      expenses: expenseTotal,
      expensesPending: expensePending,
      total: confirmedAmount === null ? null : confirmedAmount + expenseTotal,
      paymentDate,
      paymentNote,
      paymentState,
      paidAmount: completion?.paidAmount ?? null,
      paidAt: completion?.paidAt ?? null,
      requestedAmount: reqs.reduce((sum, r) => sum + r.amount, 0),
      requestedEarliestDate: reqs.length ? new Date(Math.min(...reqs.map((r) => r.desiredPaymentDate.getTime()))) : null,
    });
  }
  return result;
}

// 振込日の通知用: そのスタッフ・その月(締め月)の「申請のある経費」の合計(申請中+承認済)。
export async function sumSubmittedExpenses(staffId: string, yearMonth: string): Promise<number> {
  const rows = await prisma.expense.findMany({ where: { staffId, yearMonth, status: { in: ["SUBMITTED", "APPROVED"] } }, select: { amountTaxInclusive: true } });
  return rows.reduce((sum, e) => sum + e.amountTaxInclusive, 0);
}

// 打刻記録一覧の「該当スタッフの月の勤怠」用。1人分の集計(判定基準は attendance-summary.ts)に、遅刻の申請日を加えたもの。
export type StaffAttendanceDetail = AttendanceCounts & {
  lateReportDates: string[]; // 遅刻の申請(イレギュラー報告の「遅刻」/簡易モードの「遅刻」)があった日
};

export async function loadStaffAttendanceDetail(staffId: string, yearMonth: string, now: Date = new Date()): Promise<StaffAttendanceDetail> {
  const { start, end } = jstMonthRange(yearMonth);
  const [shifts, clocks, irregular, simple] = await Promise.all([
    prisma.shift.findMany({ where: { staffId, cancelledAt: null, startTime: { gte: start, lt: end } }, select: { id: true, startTime: true } }),
    prisma.clockRecord.findMany({ where: { staffId, timestamp: { gte: start, lt: end } }, select: { type: true, timestamp: true, shiftId: true } }),
    prisma.irregularReport.findMany({ where: { staffId, reportType: { in: ["LATE", "EARLY_LEAVE", "ABSENCE", "SAME_DAY_ABSENCE"] }, targetDate: { gte: start, lt: end } }, select: { targetDate: true, reportType: true } }),
    prisma.simpleAttendanceEntry.findMany({ where: { staffId, kind: { in: ["LATE", "EARLY_LEAVE", "ABSENT"] }, date: { startsWith: yearMonth } }, select: { date: true, kind: true } }),
  ]);

  const irrDates = (types: string[]) => irregular.filter((r) => types.includes(r.reportType)).map((r) => toJstDateValue(r.targetDate));
  const simpleDates = (kind: string) => simple.filter((r) => r.kind === kind).map((r) => r.date);

  const counts = summarizeAttendance({
    shifts,
    clocks,
    earlyLeaveDates: [...irrDates(["EARLY_LEAVE"]), ...simpleDates("EARLY_LEAVE")],
    absenceDates: [...irrDates(["ABSENCE", "SAME_DAY_ABSENCE"]), ...simpleDates("ABSENT")],
    now,
  });
  return { ...counts, lateReportDates: [...new Set([...irrDates(["LATE"]), ...simpleDates("LATE")])].sort() };
}
