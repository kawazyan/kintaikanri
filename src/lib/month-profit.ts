import { prisma } from "@/lib/prisma";
import { loadStaffMonthSummaries } from "@/lib/staff-month-summary";
import { invoiceFamilyBase, isExtraInvoice } from "@/lib/invoice-kind";
import type { StatementSnapshot } from "@/lib/invoice-draft";
import { OUTSOURCING_CATEGORY } from "@/lib/company-expense";
import { normName } from "@/lib/billing-terms";
import { staffBillableExTax } from "@/lib/invoice-draft";

// 請求管理の「月の売上・支払い予定・粗利」。
// 売上 = その月(請求の対象月)の送付済みの請求。訂正版があるときは、送付済みの一番新しい版だけを数える。
// 支払い予定 = スタッフへの報酬＋経費精算(振込関係ページと同じ計算) ＋ 別途報酬(リファラルなど) ＋ 広告費(請求した広告費の行 = Meta への実費) ＋ 外注費(会社経費の「外注費」)。
// 粗利 = 売上(税抜) − 支払い予定。固定費・税金などは含まない。
export type MonthProfit = {
  yearMonth: string;
  salesExTax: number;
  salesInclTax: number;
  invoiceCount: number;
  staffPay: number; // 金額が決まっている人の合計
  staffPayUnknown: string[]; // 金額が決まっていない人(報酬の目標額が未入力など)
  adCost: number;
  bonus: number; // 別途報酬(リファラル報酬・インセンティブなど。申請中＋承認済み)
  outsourcing: number; // 外注費(会社経費の「外注費」。他社からの請求・税抜)
  payTotal: number;
  grossProfit: number;
  // スタッフ別。sales=請求書のこの人の行(税抜) / earnings=報酬 / expenses=経費 / bonus=別途報酬。pay=null は報酬未確定。
  // 勤怠に登録されていない人の行(外部スタッフなど)と、広告費・外注費は others にまとめる。
  byStaff: { name: string; sales: number; earnings: number | null; expenses: number; bonus: number; gross: number | null }[];
  otherSales: number; // 勤怠のスタッフに当てはまらない売上(外部スタッフ・広告費など)
};

type SentInvoice = { clientId: string; kind: string; branch: string | null; invoiceNumber: string; revision: number; yearMonth: string; subtotalExTax: number; totalInclTax: number; statement: unknown };

// 同じ請求の系列(取引先・種類・店舗、別途請求は請求番号の系列)ごとに、一番新しい版だけ残す。
export function latestSent<T extends SentInvoice>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const key = [r.clientId, r.yearMonth, r.kind, r.branch ?? "", isExtraInvoice(r.kind) ? invoiceFamilyBase(r.invoiceNumber) : ""].join("|");
    const cur = best.get(key);
    if (!cur || r.revision > cur.revision) best.set(key, r);
  }
  return [...best.values()];
}

export function adCostOf(statement: unknown): number {
  const s = statement as StatementSnapshot | null;
  return (s?.clientExtras ?? []).filter((e) => e.store && e.period).reduce((a, e) => a + e.amountExTax, 0);
}

export async function loadMonthProfits(months: string[]): Promise<Map<string, MonthProfit>> {
  const out = new Map<string, MonthProfit>();
  if (!months.length) return out;
  const [sent, staff, outs, comps] = await Promise.all([
    prisma.invoice.findMany({
      where: { yearMonth: { in: months }, sentAt: { not: null }, status: { in: ["FINALIZED", "REISSUED"] } },
      select: { clientId: true, kind: true, branch: true, invoiceNumber: true, revision: true, yearMonth: true, subtotalExTax: true, totalInclTax: true, statement: true },
    }),
    prisma.staff.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, paymentMethod: true, fixedClosingDay: true, fixedPaymentMonthOffset: true, fixedPaymentDay: true },
    }),
    prisma.companyExpense.findMany({ where: { yearMonth: { in: months }, category: OUTSOURCING_CATEGORY }, select: { yearMonth: true, amount: true } }),
    prisma.compensationRequest.findMany({ where: { yearMonth: { in: months }, status: { in: ["SUBMITTED", "APPROVED"] } }, select: { yearMonth: true, staffId: true, amountTaxInclusive: true } }),
  ]);
  const latest = latestSent(sent);
  for (const ym of months) {
    const inv = latest.filter((i) => i.yearMonth === ym);
    const summaries = await loadStaffMonthSummaries(staff, ym);
    let staffPay = 0;
    const unknown: string[] = [];
    for (const s of staff) {
      const m = summaries.get(s.id);
      if (!m) continue;
      if (m.total === null) unknown.push(s.name);
      else staffPay += m.total;
    }
    const salesExTax = inv.reduce((a, i) => a + i.subtotalExTax, 0);
    const adCost = inv.reduce((a, i) => a + adCostOf(i.statement), 0);
    const outsourcing = outs.filter((o) => o.yearMonth === ym).reduce((a, o) => a + o.amount, 0);
    const bonus = comps.filter((c) => c.yearMonth === ym).reduce((a, c) => a + c.amountTaxInclusive, 0);
    const payTotal = staffPay + bonus + adCost + outsourcing;
    // スタッフ別の売上: 請求内訳書のスタッフの行を、勤怠の名前(空白を除いて一致)に振り分ける。
    const salesBy = new Map<string, number>();
    let staffSalesTotal = 0;
    const keyToId = new Map(staff.map((x) => [normName(x.name), x.id]));
    for (const i of inv) {
      for (const row of (i.statement as StatementSnapshot | null)?.staff ?? []) {
        const id = keyToId.get(normName(row.name));
        if (!id) continue;
        const v = staffBillableExTax(row);
        salesBy.set(id, (salesBy.get(id) ?? 0) + v);
        staffSalesTotal += v;
      }
    }
    const bonusBy = new Map<string, number>();
    for (const c of comps.filter((c) => c.yearMonth === ym)) bonusBy.set(c.staffId, (bonusBy.get(c.staffId) ?? 0) + c.amountTaxInclusive);
    const byStaff = staff
      .map((x) => {
        const m = summaries.get(x.id);
        const sales = salesBy.get(x.id) ?? 0;
        const earnings = m ? m.earnings : 0;
        const expenses = m?.expenses ?? 0;
        const b = bonusBy.get(x.id) ?? 0;
        return { name: x.name, sales, earnings, expenses, bonus: b, gross: earnings === null ? null : sales - earnings - expenses - b };
      })
      .filter((r) => r.sales || r.earnings || r.expenses || r.bonus || r.earnings === null)
      .sort((a, b) => (a.gross ?? -Infinity) - (b.gross ?? -Infinity));
    out.set(ym, {
      byStaff,
      otherSales: salesExTax - staffSalesTotal,
      yearMonth: ym,
      salesExTax,
      salesInclTax: inv.reduce((a, i) => a + i.totalInclTax, 0),
      invoiceCount: inv.length,
      staffPay,
      staffPayUnknown: unknown,
      adCost,
      bonus,
      outsourcing,
      payTotal,
      grossProfit: salesExTax - payTotal,
    });
  }
  return out;
}
