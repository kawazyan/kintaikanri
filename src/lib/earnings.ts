import { prisma } from "@/lib/prisma";
import { jstDayRange, jstMonthRange, toJstDateValue } from "@/lib/time";
// 受取金額の内訳(画面表示用)。金額の計算には使わない(計算結果をそのまま分解して見せるだけ)。
//  MANUAL  = 管理者が入力した金額
//  DAILY   = 1日あたり(日当 × 稼働日数)
//  MONTHLY = 月で固定(月額 ÷ 予定日数 × 出勤日数。全日出勤なら満額)
//  SPOT    = 単価指定のシフト・月固定の月1回分など(上記以外)
export type EarningsDetail = {
  mode: "MANUAL" | "DAILY" | "MONTHLY" | "SPOT";
  days: number; // 稼働(確定)日数。日付の重複は1日
  rate: number | null; // DAILY=日当 / MONTHLY=1日あたり(切り捨て後)
  baseAmount: number | null; // MONTHLY=月額(満額の基準)
  plannedDays: number | null; // MONTHLY=月額を割る予定日数
  fullAttendance: boolean; // MONTHLY=欠勤なしで満額
  mainAmount: number; // 日当分・月額分(交通費・単価指定シフトを除く)
  ownAmountTotal: number; // 単価指定シフトの合計
  ownCount: number; // 単価指定シフトの確定日数
  travelPerDay: number; // 1日あたりの交通費(税込)
  travelAmount: number; // 交通費の合計
};

export type MonthlyEarnings = {
  // The amount confirmed so far this month. `null` means it cannot be
  // computed yet (e.g. a BAND staff member hasn't entered a monthly target
  // amount) and must be shown as "－", never guessed at or shown as 0.
  confirmedAmount: number | null;
  // 内訳(金額が計算できるときだけ付く)。
  detail?: EarningsDetail;
};

// Server-side source of truth for "今月の確定受取金額". A shift day counts
// once it has both an IN and an OUT clock record tied to it. It also counts
// once its calendar day (JST) has fully ended even with only an IN and no
// OUT -- a missed clock-out is treated as having worked the shift (仕様:
// 退勤打刻漏れは稼働したものとして扱う), rather than leaving the day stuck
// unconfirmed forever until someone notices and fixes it manually.
//
// BAND shifts of staff whose pay type is DAILY: dailyRate × confirmed days (null if dailyRate is unset).
// BAND (and SPOT shifts of staff whose pay type is MONTHLY): monthly target
// (falls back to the staff's monthlyAmount) ÷ planned days this month (floored)
// × confirmed days. For MONTHLY staff the planned days are all of the month's
// shifts, including SPOT shifts that carry their own unitAmount. If no target amount has been entered yet, the BAND portion is
// undetermined and the whole total is reported as `null` rather than
// guessed or defaulted to 0.
// SPOT: each confirmed SPOT shift contributes its own per-shift unitAmount.
export async function computeMonthlyEarnings(
  staffId: string,
  yearMonth: string,
  now: Date = new Date()
): Promise<MonthlyEarnings> {
  const { start, end } = jstMonthRange(yearMonth);

  const [target, shifts, staffPay] = await Promise.all([
    prisma.monthlyEarningTarget.findUnique({
      where: { staffId_yearMonth: { staffId, yearMonth } },
    }),
    prisma.shift.findMany({
      where: { staffId, cancelledAt: null, startTime: { gte: start, lt: end } },
      include: { clockRecords: true },
    }),
    prisma.staff.findUnique({
      where: { id: staffId },
      select: { payType: true, dailyRate: true, monthlyAmount: true, dailyTravelInclTax: true },
    }),
  ]);

  // 報酬タイプ「月ごとに手入力」: 管理者が入力したその月の金額をそのまま使う(日割り・交通費の自動加算はしない)。
  // 未入力の月は金額未確定(null)。
  if (staffPay?.payType === "MANUAL") {
    const manual = await prisma.manualPayAmount.findUnique({ where: { staffId_yearMonth: { staffId, yearMonth } } });
    if (!manual) return { confirmedAmount: null };
    return {
      confirmedAmount: manual.amount,
      detail: { mode: "MANUAL", days: 0, rate: null, baseAmount: null, plannedDays: null, fullAttendance: false, mainAmount: manual.amount, ownAmountTotal: 0, ownCount: 0, travelPerDay: 0, travelAmount: 0 },
    };
  }

  const isConfirmed = (s: (typeof shifts)[number]) => {
    const hasIn = s.clockRecords.some((r) => r.type === "IN");
    const hasOut = s.clockRecords.some((r) => r.type === "OUT");
    if (hasIn && hasOut) return true;
    if (hasIn && !hasOut) return now >= jstDayRange(s.startTime).end;
    return false;
  };

  // 報酬設定が「月固定」の人は、シフトの種別(BAND/SPOT)に関係なく、欠勤したら日割りで引く。
  // 単価が入っているSPOTシフト(unitAmount)だけは、従来どおりそのシフトの単価で計算する。
  const monthlyFixed = staffPay?.payType === "MONTHLY";
  const isBandLike = (s: (typeof shifts)[number]) =>
    s.workType === "BAND" || (monthlyFixed && s.workType === "SPOT" && s.unitAmount === null);
  const bandShifts = shifts.filter(isBandLike);
  const spotShifts = shifts.filter((s) => !isBandLike(s));

  // SPOT: シフトに単価(unitAmount)が入っているものはその金額を使う(既存データを維持)。
  // 単価が入っていないシフトは、スタッフの報酬設定(管理者が設定)で計算する:
  //   DAILY   = 日当 × 該当シフトの確定日数
  //   MONTHLY = 月固定額(稼働日数に関わらず、該当シフトが1日でもあれば月1回)
  //   未設定  = 0(従来どおり)
  const spotConfirmed = spotShifts.filter(isConfirmed);
  const withOwnAmount = spotConfirmed.filter((s) => s.unitAmount !== null);
  const withoutOwnAmount = spotConfirmed.filter((s) => s.unitAmount === null);
  const ownAmountTotal = withOwnAmount.reduce((sum, s) => sum + (s.unitAmount ?? 0), 0);
  let settingAmount = 0;
  if (staffPay?.payType === "DAILY") {
    settingAmount = (staffPay.dailyRate ?? 0) * withoutOwnAmount.length;
  } else if (staffPay?.payType === "MONTHLY" && withoutOwnAmount.length > 0) {
    settingAmount = staffPay.monthlyAmount ?? 0;
  }
  // 1日あたりの交通費(税込)が決まっている人は、確定した稼働日数(日付の重複は1日)× その額を加える。
  const confirmedDays = new Set(shifts.filter(isConfirmed).map((s) => toJstDateValue(s.startTime))).size;
  const travelAmount = (staffPay?.dailyTravelInclTax ?? 0) * confirmedDays;
  const spotConfirmedAmount = ownAmountTotal + settingAmount + travelAmount;

  if (bandShifts.length > 0 && staffPay?.payType === "DAILY") {
    // 報酬設定が「日当」の人は、BANDシフトも 日当 × 確定した日数 で計算する(スタッフが入力する目標額は使わない)。
    // 日当が未設定なら金額は決められないので null。
    if (staffPay.dailyRate === null) return { confirmedAmount: null };
    const bandDays = new Set(bandShifts.filter(isConfirmed).map((s) => toJstDateValue(s.startTime))).size;
    return {
      confirmedAmount: staffPay.dailyRate * bandDays + spotConfirmedAmount,
      detail: {
        mode: "DAILY", days: bandDays, rate: staffPay.dailyRate, baseAmount: null, plannedDays: null, fullAttendance: false,
        mainAmount: staffPay.dailyRate * bandDays + settingAmount, ownAmountTotal, ownCount: withOwnAmount.length,
        travelPerDay: staffPay.dailyTravelInclTax ?? 0, travelAmount,
      },
    };
  }

  if (bandShifts.length > 0) {
    // 基準額は、その月の目標額。月固定の人で目標額が未入力なら、報酬設定の月額を使う。
    const targetAmount = target?.targetAmount ?? (monthlyFixed ? (staffPay?.monthlyAmount ?? null) : null);
    if (targetAmount === null) {
      // A BAND plan exists but the monthly target hasn't been entered yet:
      // the per-day rate can't be derived, so the whole total is unknown.
      return { confirmedAmount: null };
    }
    // 月固定の人は、その月の全シフト(キャンセル除く)で月額を割る。単価入りのSPOTシフト(上で個別に加算済み)が
    // 同じ月にあるとき、月額の全額が単価なしのシフトだけに乗って二重に計上されるのを防ぐ。
    const plannedShifts = monthlyFixed ? shifts.length : bandShifts.length;
    const dailyRate = Math.floor(targetAmount / plannedShifts);
    const bandConfirmedDays = bandShifts.filter(isConfirmed).length;
    // その月のシフトがすべて月額対象で、全日確定した(欠勤なし)ときは、切り捨ての端数を出さず目標額の満額にする。
    const fullAttendance = bandShifts.length === shifts.length && bandConfirmedDays === bandShifts.length;
    const bandConfirmedAmount = fullAttendance ? targetAmount : dailyRate * bandConfirmedDays;
    return {
      confirmedAmount: bandConfirmedAmount + spotConfirmedAmount,
      detail: {
        mode: "MONTHLY", days: bandConfirmedDays, rate: dailyRate, baseAmount: targetAmount, plannedDays: plannedShifts, fullAttendance,
        mainAmount: bandConfirmedAmount + settingAmount, ownAmountTotal, ownCount: withOwnAmount.length,
        travelPerDay: staffPay?.dailyTravelInclTax ?? 0, travelAmount,
      },
    };
  }

  return {
    confirmedAmount: spotConfirmedAmount,
    detail: {
      mode: staffPay?.payType === "DAILY" ? "DAILY" : staffPay?.payType === "MONTHLY" ? "MONTHLY" : "SPOT",
      days: staffPay?.payType === "DAILY" ? withoutOwnAmount.length : confirmedDays,
      rate: staffPay?.payType === "DAILY" ? (staffPay.dailyRate ?? 0) : null,
      baseAmount: staffPay?.payType === "MONTHLY" && withoutOwnAmount.length > 0 ? (staffPay.monthlyAmount ?? 0) : null,
      plannedDays: null, fullAttendance: false,
      mainAmount: settingAmount, ownAmountTotal, ownCount: withOwnAmount.length,
      travelPerDay: staffPay?.dailyTravelInclTax ?? 0, travelAmount,
    },
  };
}

// Lifetime confirmed earnings across every month the staff has ever had a
// shift in. A month whose BAND target is still unset simply contributes 0
// here (it doesn't block the rest of the staff member's confirmed total —
// only that specific month's own display shows "－").
export async function computeCumulativeConfirmedAmount(staffId: string): Promise<number> {
  const shifts = await prisma.shift.findMany({
    where: { staffId, cancelledAt: null },
    select: { startTime: true },
  });
  const yearMonths = new Set(shifts.map((s) => toJstDateValue(s.startTime).slice(0, 7)));

  let total = 0;
  for (const yearMonth of yearMonths) {
    const { confirmedAmount } = await computeMonthlyEarnings(staffId, yearMonth);
    if (confirmedAmount !== null) total += confirmedAmount;
  }
  return total;
}

// 申請支払の人の承認済みの経費(月ごと・税込)。申請中・却下・下書きは含めない。
// 経費は別に払うものではなく、稼働単価以外の請求として「確定した受取」に足して一緒に払う。
export async function computeApprovedExpensesByMonth(staffId: string): Promise<Map<string, number>> {
  const rows = await prisma.expense.findMany({
    where: { staffId, status: "APPROVED" },
    select: { yearMonth: true, amountTaxInclusive: true },
  });
  const byMonth = new Map<string, number>();
  for (const r of rows) byMonth.set(r.yearMonth, (byMonth.get(r.yearMonth) ?? 0) + r.amountTaxInclusive);
  return byMonth;
}

// 月ごとの確定受取の一覧(古い月 → 新しい月)。computeCumulativeConfirmedAmount と同じ月の拾い方・同じ計算で、
// 金額が計算できない月(null)は稼働分0として扱う(累計では0として扱われるのと同じ)。振込関係の「何月分」表示用。
// confirmed = 稼働分(work) + 承認済みの経費(expense)。経費だけの月(稼働なし)も一覧に出す。
export async function computeMonthlyConfirmedList(
  staffId: string,
  now: Date = new Date()
): Promise<{ yearMonth: string; confirmed: number; work: number; expense: number; detail?: EarningsDetail }[]> {
  const [shifts, expenseByMonth] = await Promise.all([
    prisma.shift.findMany({
      where: { staffId, cancelledAt: null },
      select: { startTime: true },
    }),
    computeApprovedExpensesByMonth(staffId),
  ]);
  const shiftMonths = new Set(shifts.map((s) => toJstDateValue(s.startTime).slice(0, 7)));
  const yearMonths = [...new Set([...shiftMonths, ...expenseByMonth.keys()])].sort();
  const list: { yearMonth: string; confirmed: number; work: number; expense: number; detail?: EarningsDetail }[] = [];
  for (const yearMonth of yearMonths) {
    const expense = expenseByMonth.get(yearMonth) ?? 0;
    if (shiftMonths.has(yearMonth)) {
      const { confirmedAmount, detail } = await computeMonthlyEarnings(staffId, yearMonth, now);
      if (confirmedAmount !== null) {
        list.push({ yearMonth, confirmed: confirmedAmount + expense, work: confirmedAmount, expense, detail });
        continue;
      }
    }
    if (expense > 0) list.push({ yearMonth, confirmed: expense, work: 0, expense });
  }
  return list;
}

export type TransferBalance = {
  confirmedAmount: number; // lifetime confirmed earnings + 承認済みの経費
  requestedAmount: number; // sum of REQUESTING + PAID transfer requests
  availableAmount: number; // confirmedAmount - requestedAmount, floored at 0
};

// Server-side source of truth for how much a staff member may still
// request. Requests already marked PAID still count against the pool (the
// money has been used), preventing the same confirmed reward from being
// claimed twice (spec item 45).
export async function computeTransferBalance(staffId: string): Promise<TransferBalance> {
  const [workAmount, expenseByMonth, requests] = await Promise.all([
    computeCumulativeConfirmedAmount(staffId),
    computeApprovedExpensesByMonth(staffId),
    prisma.transferRequest.findMany({
      where: { staffId, status: { in: ["REQUESTING", "PAID"] } },
      select: { amount: true },
    }),
  ]);
  // 承認済みの経費は稼働分と同じ「確定した受取」に足す(月ごとの一覧 computeMonthlyConfirmedList と同じ合計になる)。
  const confirmedAmount = workAmount + [...expenseByMonth.values()].reduce((sum, v) => sum + v, 0);
  const requestedAmount = requests.reduce((sum, r) => sum + r.amount, 0);
  const availableAmount = Math.max(0, confirmedAmount - requestedAmount);
  return { confirmedAmount, requestedAmount, availableAmount };
}
