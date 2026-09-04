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
// BAND: monthly target ÷ planned BAND days this month (floored) × confirmed
// BAND days. If no target amount has been entered yet, the BAND portion is
// undetermined and the whole total is reported as `null` rather than
// guessed or defaulted to 0.
// SPOT: each confirmed SPOT shift contributes its own per-shift unitAmount.
export async function computeMonthlyEarnings(
  staffId: string,
  yearMonth: string,
  now: Date = new Date()
): Promise<MonthlyEarnings> {
  const { start, end } = jstMonthRange(yearMonth);

  const [target, shifts] = await Promise.all([
    prisma.monthlyEarningTarget.findUnique({
      where: { staffId_yearMonth: { staffId, yearMonth } },
    }),
    prisma.shift.findMany({
      where: { staffId, cancelledAt: null, startTime: { gte: start, lt: end } },
      include: { clockRecords: true },
    }),
  ]);

  const isConfirmed = (s: (typeof shifts)[number]) => {
    const hasIn = s.clockRecords.some((r) => r.type === "IN");
    const hasOut = s.clockRecords.some((r) => r.type === "OUT");
    if (hasIn && hasOut) return true;
    if (hasIn && !hasOut) return now >= jstDayRange(s.startTime).end;
    return false;
  };

  const bandShifts = shifts.filter((s) => s.workType === "BAND");
  const spotShifts = shifts.filter((s) => s.workType === "SPOT");

  const spotConfirmedAmount = spotShifts
    .filter(isConfirmed)
    .reduce((sum, s) => sum + (s.unitAmount ?? 0), 0);

  if (bandShifts.length > 0) {
    const targetAmount = target?.targetAmount ?? null;
    if (targetAmount === null) {
      // A BAND plan exists but the monthly target hasn't been entered yet:
      // the per-day rate can't be derived, so the whole total is unknown.
      return { confirmedAmount: null };
    }
    const dailyRate = Math.floor(targetAmount / bandShifts.length);
    const bandConfirmedDays = bandShifts.filter(isConfirmed).length;
    const bandConfirmedAmount = dailyRate * bandConfirmedDays;
    return { confirmedAmount: bandConfirmedAmount + spotConfirmedAmount };
  }

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
