import { prisma } from "@/lib/prisma";
import { computeMonthlyEarnings } from "@/lib/earnings";
import { fixedPaymentDueToday } from "@/lib/payment";
import { type PaydayItem } from "@/lib/payday-message";
import { sumSubmittedExpenses } from "@/lib/staff-month-summary";
import { jstDayRange } from "@/lib/time";

// 「今日が振込日」のスタッフと金額を集める(朝9時のLINE通知と、管理ダッシュボードの急ぎ表示で共通)。
// 対象: ①固定支払のスタッフで、(土日祝・12/29〜1/3の前倒し後の)支払日が今日 ②申請支払のスタッフの、希望振込日が今日で未振込の申請。
export async function collectPaydayItems(now: Date): Promise<PaydayItem[]> {
  const { start, end } = jstDayRange(now);
  const items: PaydayItem[] = [];

  const fixedStaff = await prisma.staff.findMany({
    where: { status: "ACTIVE", paymentMethod: "FIXED" },
    select: { id: true, name: true, fixedClosingDay: true, fixedPaymentMonthOffset: true, fixedPaymentDay: true },
    orderBy: { employeeCode: "asc" },
  });
  for (const s of fixedStaff) {
    const due = fixedPaymentDueToday(s, now);
    if (!due) continue;
    const [, m] = due.closingYearMonth.split("-").map(Number);
    if (!due.monthEndClosing) {
      items.push({ kind: "FIXED", staffId: s.id, closingYearMonth: due.closingYearMonth, name: s.name, amount: null, note: "締日が月末以外のため金額は未計算" });
      continue;
    }
    const { confirmedAmount } = await computeMonthlyEarnings(s.id, due.closingYearMonth, now);
    // 振込金額 = 受取金額 + 申請のある経費(申請中・承認済)。
    const expenses = await sumSubmittedExpenses(s.id, due.closingYearMonth);
    items.push({
      kind: "FIXED",
      staffId: s.id,
      closingYearMonth: due.closingYearMonth,
      name: s.name,
      amount: confirmedAmount === null ? null : confirmedAmount + expenses,
      note: `${m}月分${expenses > 0 ? `・経費¥${expenses.toLocaleString("ja-JP")}込み` : ""}`,
    });
  }

  const requests = await prisma.transferRequest.findMany({
    where: { status: "REQUESTING", desiredPaymentDate: { gte: start, lt: end } },
    include: { staff: { select: { name: true } } },
    orderBy: { requestedAt: "asc" },
  });
  for (const r of requests) items.push({ kind: "REQUEST", staffId: r.staffId, name: r.staff.name, amount: r.amount });

  return items;
}
