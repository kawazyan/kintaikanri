import { currentJstYearMonth, daysInJstMonth, makeJstDateOnly, jstDayRange } from "@/lib/time";

export type FixedScheduleInput = {
  fixedClosingDay: number | null;
  fixedPaymentMonthOffset: number | null;
  fixedPaymentDay: number | null;
};

function resolveDay(year: number, month1: number, day: number): number {
  // 0 is the sentinel for "月末" (month-end); otherwise clamp to the month's
  // actual last day (e.g. day=31 in a 30-day month).
  const dim = daysInJstMonth(year, month1);
  return day === 0 ? dim : Math.min(day, dim);
}

function addMonths(year: number, month1: number, offset: number): { year: number; month1: number } {
  const total = month1 - 1 + offset;
  const y = year + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12 + 1;
  return { year: y, month1: m };
}

// Computes the next upcoming fixed-payment date (item 53/54). Closing day
// only tags which accounting period a payment covers; it doesn't itself
// shift the payment date, so it isn't used in this date arithmetic —
// payment dates recur once per month at (closing month + monthOffset,
// paymentDay), and closings occur every month.
export function nextFixedPaymentDate(
  staff: FixedScheduleInput,
  now: Date = new Date()
): Date | null {
  const { fixedClosingDay, fixedPaymentMonthOffset, fixedPaymentDay } = staff;
  if (fixedClosingDay == null || fixedPaymentMonthOffset == null || fixedPaymentDay == null) {
    return null;
  }

  const { start: todayStart } = jstDayRange(now);
  const [baseY, baseM] = currentJstYearMonth(now).split("-").map(Number);

  let best: Date | null = null;
  for (let offset = -2; offset <= 3; offset++) {
    const closing = addMonths(baseY, baseM, offset);
    const payment = addMonths(closing.year, closing.month1, fixedPaymentMonthOffset);
    const paymentDay = resolveDay(payment.year, payment.month1, fixedPaymentDay);
    const paymentDate = makeJstDateOnly(payment.year, payment.month1, paymentDay);
    if (paymentDate.getTime() >= todayStart.getTime()) {
      if (best === null || paymentDate.getTime() < best.getTime()) best = paymentDate;
    }
  }
  return best;
}
