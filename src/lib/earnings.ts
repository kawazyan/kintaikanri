import { prisma } from "@/lib/prisma";
import { jstDayRange, jstMonthRange, toJstDateValue } from "@/lib/time";
export type MonthlyEarnings = {
  // The amount confirmed so far this month. `null` means it cannot be
  // computed yet (e.g. a BAND staff member hasn't entered a monthly target
  // amount) and must be shown as "－", never guessed at or shown as 0.
  confirmedAmount: number | null;
};

// Server-side source of truth for "今月の確定受取金額". A shift day counts
// once it has both an IN and an OUT clock record tied to it. It also counts
// once its calendar day (JST) has fully ended even with only an IN and no
// OUT -- a missed clock-out is treated as having worked the shift (仕様:
// 退勤打刻漏れは稼働したものとして扱う), rather than leaving the day stuck
// unconfirmed forever until someone notices and fixes it manually.
//
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
    return { confirmedAmount: bandConfirmedAmount + spotConfirmedAmount };  }

  return { confirmedAmount: spotConfirmedAmount };
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

export type TransferBalance = {
  confirmedAmount: number; // lifetime confirmed earnings
  requestedAmount: number; // sum of REQUESTING + PAID transfer requests
  availableAmount: number; // confirmedAmount - requestedAmount, floored at 0
};

// Server-side source of truth for how much a staff member may still
// request. Requests already marked PAID still count against the pool (the
// money has been used), preventing the same confirmed reward from being
// claimed twice (spec item 45).
export async function computeTransferBalance(staffId: string): Promise<TransferBalance> {
  const [confirmedAmount, requests] = await Promise.all([
    computeCumulativeConfirmedAmount(staffId),
    prisma.transferRequest.findMany({
      where: { staffId, status: { in: ["REQUESTING", "PAID"] } },
      select: { amount: true },
    }),
  ]);
  const requestedAmount = requests.reduce((sum, r) => sum + r.amount, 0);
  const availableAmount = Math.max(0, confirmedAmount - requestedAmount);
  return { confirmedAmount, requestedAmount, availableAmount };
}
