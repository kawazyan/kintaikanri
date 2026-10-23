import { prisma } from "@/lib/prisma";
import { computeMonthlyEarnings } from "@/lib/earnings";
import { fixedPaymentDateForClosingMonth } from "@/lib/payment";
import { collectPaydayItems } from "@/lib/payday-items";
import type { PaydayItem } from "@/lib/payday-message";
import { currentJstYearMonth, jstDayRange, jstMonthRange, toJstDateValue } from "@/lib/time";

// 管理ダッシュボードの「急ぎ案件」。
//  ①今日が支払日のスタッフ(固定支払の前倒し後の支払日 / 申請支払の希望振込日)
//  ②支払い金額が未入力のスタッフ: 毎月20日以降、今月中に支払日が来る固定支払(月末締め)のうち、
//    その支払いの対象月の受取金額が計算できない人(月の目標額も報酬設定の月額も未入力)

export type AmountMissingItem = { staffId: string; name: string; closingYearMonth: string; paymentDate: Date };

export const AMOUNT_MISSING_FROM_DAY = 20; // 毎月この日以降に表示する

const addMonth = (yearMonth: string, offset: number) => {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export async function loadUrgentItems(now: Date = new Date()): Promise<{ paydayToday: PaydayItem[]; amountMissing: AmountMissingItem[] }> {
  const paydayToday = await collectPaydayItems(now);

  const amountMissing: AmountMissingItem[] = [];
  const dayOfMonth = Number(toJstDateValue(now).slice(8, 10));
  if (dayOfMonth >= AMOUNT_MISSING_FROM_DAY) {
    const thisMonth = currentJstYearMonth(now);
    const { start: monthStart, end: monthEnd } = jstMonthRange(thisMonth);
    const todayStart = jstDayRange(now).start;
    const fixedStaff = await prisma.staff.findMany({
      where: { status: "ACTIVE", paymentMethod: "FIXED" },
      select: { id: true, name: true, fixedClosingDay: true, fixedPaymentMonthOffset: true, fixedPaymentDay: true },
      orderBy: { employeeCode: "asc" },
    });
    for (const s of fixedStaff) {
      // 月末締め以外は暦月の金額を計算できないので対象外(振込日通知と同じ扱い)。
      if (s.fixedClosingDay !== 0 && s.fixedClosingDay !== 31) continue;
      for (const closing of [addMonth(thisMonth, -1), thisMonth]) {
        const paymentDate = fixedPaymentDateForClosingMonth(s, closing);
        if (!paymentDate) continue;
        // 今月中(今日以降)に支払日が来る支払いだけ見る。
        if (paymentDate < monthStart || paymentDate >= monthEnd || paymentDate < todayStart) continue;
        const { confirmedAmount } = await computeMonthlyEarnings(s.id, closing, now);
        if (confirmedAmount === null) amountMissing.push({ staffId: s.id, name: s.name, closingYearMonth: closing, paymentDate });
      }
    }
  }
  return { paydayToday, amountMissing };
}
