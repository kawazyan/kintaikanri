import { prisma } from "@/lib/prisma";
import { computeMonthlyEarnings } from "@/lib/earnings";
import { fixedPaymentDateForClosingMonth } from "@/lib/payment";
import { fixedPaymentState } from "@/lib/fixed-payment-status";
import { sumSubmittedExpenses } from "@/lib/staff-month-summary";
import { currentJstYearMonth, jstDayRange, jstMonthRange, toJstDateValue } from "@/lib/time";

// 管理ダッシュボードの「急ぎ案件」。
//  ①支払日が今日以前なのに「振込完了」が押されていない(=未振込の)支払い
//    固定支払: 前倒し後の支払日が今日以前で、振込完了ボタン未押下(10/23以降の支払日が対象)
//    申請支払: 希望振込日が今日以前で、振込完了(振込済み)にしていない申請
//  ②支払い金額が未入力のスタッフ: 毎月20日以降、今月中に支払日が来る固定支払(月末締め)のうち、
//    その支払いの対象月の受取金額が計算できない人(月の目標額も報酬設定の月額も未入力)

export type UnpaidItem = {
  kind: "FIXED" | "REQUEST";
  staffId: string;
  name: string;
  amount: number | null;
  closingYearMonth?: string; // 固定支払の対象の締め月
  paymentDate: Date;
  isToday: boolean;
};

export type AmountMissingItem = { staffId: string; name: string; closingYearMonth: string; paymentDate: Date };

export const AMOUNT_MISSING_FROM_DAY = 20; // 毎月この日以降に表示する

const addMonth = (yearMonth: string, offset: number) => {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export async function loadUrgentItems(now: Date = new Date()): Promise<{ unpaid: UnpaidItem[]; amountMissing: AmountMissingItem[] }> {
  const { start: todayStart, end: todayEnd } = jstDayRange(now);
  const unpaid: UnpaidItem[] = [];

  // 固定支払: 月末締めのスタッフの、直近の支払い(締め月 = 3か月前〜今月)のうち、未振込のもの
  const thisMonthForUnpaid = currentJstYearMonth(now);
  const closingCandidates = [-3, -2, -1, 0].map((o) => addMonth(thisMonthForUnpaid, o));
  const fixedAll = await prisma.staff.findMany({
    where: { status: "ACTIVE", paymentMethod: "FIXED" },
    select: { id: true, name: true, fixedClosingDay: true, fixedPaymentMonthOffset: true, fixedPaymentDay: true },
    orderBy: { employeeCode: "asc" },
  });
  const completions = await prisma.fixedPaymentCompletion.findMany({
    where: { staffId: { in: fixedAll.map((s) => s.id) }, closingYearMonth: { in: closingCandidates } },
    select: { staffId: true, closingYearMonth: true },
  });
  const done = new Set(completions.map((c) => `${c.staffId}:${c.closingYearMonth}`));
  for (const s of fixedAll) {
    if (s.fixedClosingDay !== 0 && s.fixedClosingDay !== 31) continue;
    for (const closing of closingCandidates) {
      const paymentDate = fixedPaymentDateForClosingMonth(s, closing);
      if (!paymentDate) continue;
      if (fixedPaymentState({ paymentDate, completed: done.has(`${s.id}:${closing}`), now }) !== "OVERDUE") continue;
      const { confirmedAmount } = await computeMonthlyEarnings(s.id, closing, now);
      const amount = confirmedAmount === null ? null : confirmedAmount + (await sumSubmittedExpenses(s.id, closing));
      unpaid.push({ kind: "FIXED", staffId: s.id, name: s.name, amount, closingYearMonth: closing, paymentDate, isToday: paymentDate.getTime() === todayStart.getTime() });
    }
  }

  // 申請支払: 希望振込日が今日以前で、まだ振込済みにしていない申請
  const requests = await prisma.transferRequest.findMany({
    where: { status: "REQUESTING", desiredPaymentDate: { lt: todayEnd } },
    include: { staff: { select: { name: true } } },
    orderBy: { desiredPaymentDate: "asc" },
  });
  for (const r of requests) {
    unpaid.push({ kind: "REQUEST", staffId: r.staffId, name: r.staff.name, amount: r.amount, paymentDate: r.desiredPaymentDate, isToday: r.desiredPaymentDate.getTime() >= todayStart.getTime() });
  }

  const amountMissing: AmountMissingItem[] = [];
  const dayOfMonth = Number(toJstDateValue(now).slice(8, 10));
  if (dayOfMonth >= AMOUNT_MISSING_FROM_DAY) {
    const thisMonth = currentJstYearMonth(now);
    const { start: monthStart, end: monthEnd } = jstMonthRange(thisMonth);
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
  return { unpaid, amountMissing };
}
