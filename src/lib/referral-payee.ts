import { prisma } from "@/lib/prisma";
import { computeMonthlyEarnings } from "@/lib/earnings";
import { currentJstYearMonth } from "@/lib/time";

// リファラルのみの人(スタッフ登録なし)への支払いの計算。画面を開くたびに計算し、払った記録(ReferralPayeePaid)だけを残す。
//   FIXED       : 毎月の固定額
//   SHARE_STAFF : (請求書の単価(税抜) − 本人への支払い(税込) − システム利用料) × 取り分%  … 端数は切り捨て・0円未満は0円
//   SHARE_EXTRA : (別途請求(営業協力費など・税抜) − システム利用料) × 取り分%            … 同上
// 支払い月 = 稼働月 + payLagMonths の月末。

export type PayeeLine = { label: string; amount: number; kind: "plus" | "minus" | "result" | "note" };
export type PayeeRow = {
  ruleId: string;
  payeeId: string;
  payeeName: string;
  label: string;
  workMonth: string;
  dueDate: string; // YYYY-MM-DD(支払い期限=月末)
  dueMonth: string;
  amount: number | null; // 計算できないときは null
  lines: PayeeLine[]; // 内訳(計算式)
  pendingReason: string | null; // 計算できない理由
  paid: { amount: number; paidAt: Date; operatorName: string | null } | null;
};

const addMonths = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const lastDayOf = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

// 請求書の金額(その月・その取引先で最新の送付済みの版)。訂正版(REISSUED)に置き換えられたものは使わない。
async function sentInvoices(clientNameLike: string, workMonth: string, kind: "WORK" | "EXTRA") {
  const rows = await prisma.invoice.findMany({
    where: { yearMonth: workMonth, kind, status: "FINALIZED", client: { name: { contains: clientNameLike } } },
    select: { invoiceNumber: true, branch: true, subtotalExTax: true, statement: true },
  });
  return rows;
}

export async function loadPayeeRows(now: Date = new Date()): Promise<PayeeRow[]> {
  const [payees, rules, paids] = await Promise.all([
    prisma.referralPayee.findMany(),
    prisma.referralPayeeRule.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.referralPayeePaid.findMany(),
  ]);
  const payeeName = new Map(payees.map((p) => [p.id, p.name]));
  const paidMap = new Map(paids.map((p) => [`${p.ruleId}|${p.workMonth}`, p]));
  const cur = currentJstYearMonth(now);
  const rows: PayeeRow[] = [];

  for (const r of rules) {
    // 稼働月が今月以前のものを出す(来月以降は出さない)
    for (let wm = r.fromMonth; wm <= cur; wm = addMonths(wm, 1)) {
      const dueMonth = addMonths(wm, r.payLagMonths);
      const base = {
        ruleId: r.id,
        payeeId: r.payeeId,
        payeeName: payeeName.get(r.payeeId) ?? "",
        label: r.label,
        workMonth: wm,
        dueMonth,
        dueDate: lastDayOf(dueMonth),
      };
      const p = paidMap.get(`${r.id}|${wm}`);
      const paid = p ? { amount: p.amount, paidAt: p.paidAt, operatorName: p.operatorName } : null;
      const pending = (reason: string): PayeeRow => ({ ...base, amount: null, lines: [], pendingReason: reason, paid });

      if (r.kind === "FIXED") {
        const amt = r.amount ?? 0;
        rows.push({ ...base, amount: amt, lines: [{ label: "月額（固定）", amount: amt, kind: "result" }], pendingReason: null, paid });
        continue;
      }

      const fee = r.systemFee;
      const pct = r.sharePercent;
      const share = (x: number) => Math.max(0, Math.floor((x * pct) / 100));

      if (r.kind === "SHARE_EXTRA") {
        const inv = await sentInvoices(r.clientName ?? "", wm, "EXTRA");
        if (!inv.length) {
          rows.push(pending(`${r.clientName}への別途請求（営業協力費）が、まだ送付済みになっていません`));
          continue;
        }
        const gross = inv.reduce((a, i) => a + i.subtotalExTax, 0);
        const raw = gross - fee;
        rows.push({
          ...base,
          amount: share(raw),
          lines: [
            { label: `営業協力費（税抜・請求書 ${inv.map((i) => i.invoiceNumber).join("、")}）`, amount: gross, kind: "plus" },
            { label: "システム利用料", amount: fee, kind: "minus" },
            { label: `残り ${raw.toLocaleString("ja-JP")}円 × ${pct}%`, amount: share(raw), kind: "result" },
            ...(raw < 0 ? [{ label: "0円未満のため0円", amount: 0, kind: "note" as const }] : []),
          ],
          pendingReason: null,
          paid,
        });
        continue;
      }

      if (r.kind === "SHARE_STAFF") {
        const inv = await sentInvoices(r.clientName ?? "", wm, "WORK");
        let gross: number | null = null;
        let invNo = "";
        for (const i of inv) {
          const st = (i.statement as { staff?: { name?: string; serviceExTax?: number }[] } | null)?.staff ?? [];
          const hit = st.find((s) => (s.name ?? "").replace(/[\s　]/g, "").startsWith(r.staffName ?? "\u0000"));
          if (hit && typeof hit.serviceExTax === "number") {
            gross = (gross ?? 0) + hit.serviceExTax;
            invNo = i.invoiceNumber;
          }
        }
        if (gross === null) {
          rows.push(pending(`${r.staffName}さんの${r.clientName}への請求書が、まだ送付済みになっていません`));
          continue;
        }
        const staff = await prisma.staff.findFirst({ where: { name: { startsWith: r.staffName ?? "\u0000" } }, select: { id: true } });
        const earn = staff ? await computeMonthlyEarnings(staff.id, wm, now) : null;
        if (!earn || earn.confirmedAmount === null) {
          rows.push(pending(`${r.staffName}さんの本人支払い額が、まだ計算できません`));
          continue;
        }
        const raw = gross - earn.confirmedAmount - fee;
        rows.push({
          ...base,
          amount: share(raw),
          lines: [
            { label: `${r.staffName}さんの単価（税抜・請求書 ${invNo}）`, amount: gross, kind: "plus" },
            { label: `${r.staffName}さんへの本人支払い（税込）`, amount: earn.confirmedAmount, kind: "minus" },
            { label: "システム利用料", amount: fee, kind: "minus" },
            { label: `残り ${raw.toLocaleString("ja-JP")}円 × ${pct}%`, amount: share(raw), kind: "result" },
            ...(raw < 0 ? [{ label: "0円未満のため0円", amount: 0, kind: "note" as const }] : []),
          ],
          pendingReason: null,
          paid,
        });
      }
    }
  }
  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.payeeName.localeCompare(b.payeeName));
}
