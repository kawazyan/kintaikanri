import { prisma } from "@/lib/prisma";
import { loadStaffMonthSummaries } from "@/lib/staff-month-summary";
import { latestSent } from "@/lib/month-profit";
import { normName } from "@/lib/billing-terms";
import { staffBillableExTax, type StatementSnapshot } from "@/lib/invoice-draft";
import { jstMonthRange, toJstDateValue } from "@/lib/time";

// スタッフ詳細の「月別の実績」。
// 売上 = 送付済みの請求(訂正版は最新の版)の請求内訳書のうち、このスタッフの行(名前が一致)の合計(税抜。業務委託費＋交通費＋経費)。
// 報酬＋経費 = 振込関係ページと同じ計算(その月の確定報酬＋申請中・承認済みの経費)。null=金額が決まっていない。
// 粗利 = 売上 − 報酬＋経費。振込済み = 固定支払の振込完了(締め月)＋振込申請の振込完了(振込した月)。
export type StaffMonthRow = { yearMonth: string; sales: number; pay: number | null; gross: number | null; paid: number };

export async function loadStaffHistory(staffId: string, maxMonths = 12): Promise<{ rows: StaffMonthRow[]; totals: { sales: number; pay: number; gross: number; paid: number; unknownMonths: number } }> {
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true, name: true, paymentMethod: true, fixedClosingDay: true, fixedPaymentMonthOffset: true, fixedPaymentDay: true } });
  if (!staff) return { rows: [], totals: { sales: 0, pay: 0, gross: 0, paid: 0, unknownMonths: 0 } };
  const key = normName(staff.name);

  const [shifts, invoices, fixedPaid, transfers] = await Promise.all([
    prisma.shift.findMany({ where: { staffId, cancelledAt: null }, select: { startTime: true } }),
    prisma.invoice.findMany({
      where: { sentAt: { not: null }, status: { in: ["FINALIZED", "REISSUED"] } },
      select: { clientId: true, kind: true, branch: true, invoiceNumber: true, revision: true, yearMonth: true, subtotalExTax: true, totalInclTax: true, statement: true },
    }),
    prisma.fixedPaymentCompletion.findMany({ where: { staffId }, select: { closingYearMonth: true, paidAmount: true } }),
    prisma.transferRequest.findMany({ where: { staffId, status: "PAID" }, select: { paidAt: true, paidAmount: true, amount: true } }),
  ]);

  const salesByMonth = new Map<string, number>();
  for (const inv of latestSent(invoices)) {
    const st = inv.statement as StatementSnapshot | null;
    for (const s of st?.staff ?? []) {
      if (normName(s.name) !== key) continue;
      salesByMonth.set(inv.yearMonth, (salesByMonth.get(inv.yearMonth) ?? 0) + staffBillableExTax(s));
    }
  }
  const paidByMonth = new Map<string, number>();
  for (const f of fixedPaid) paidByMonth.set(f.closingYearMonth, (paidByMonth.get(f.closingYearMonth) ?? 0) + f.paidAmount);
  for (const t of transfers) {
    if (!t.paidAt) continue;
    const ym = toJstDateValue(t.paidAt).slice(0, 7);
    paidByMonth.set(ym, (paidByMonth.get(ym) ?? 0) + (t.paidAmount ?? t.amount));
  }

  const months = [...new Set([...shifts.map((s) => toJstDateValue(s.startTime).slice(0, 7)), ...salesByMonth.keys(), ...paidByMonth.keys()])]
    .filter((ym) => jstMonthRange(ym).start.getTime() <= Date.now())
    .sort()
    .reverse()
    .slice(0, maxMonths);

  const rows: StaffMonthRow[] = [];
  for (const ym of months) {
    const sum = (await loadStaffMonthSummaries([staff], ym)).get(staff.id);
    const pay = sum ? sum.total : null;
    const sales = salesByMonth.get(ym) ?? 0;
    rows.push({ yearMonth: ym, sales, pay, gross: pay === null ? null : sales - pay, paid: paidByMonth.get(ym) ?? 0 });
  }
  const totals = rows.reduce(
    (a, r) => ({ sales: a.sales + r.sales, pay: a.pay + (r.pay ?? 0), gross: a.gross + (r.gross ?? 0), paid: a.paid + r.paid, unknownMonths: a.unknownMonths + (r.pay === null ? 1 : 0) }),
    { sales: 0, pay: 0, gross: 0, paid: 0, unknownMonths: 0 }
  );
  return { rows, totals };
}
