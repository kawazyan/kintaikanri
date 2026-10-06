import { addTax, computeInvoiceTotals, splitInclusiveTax } from "@/lib/billing";
import { normName } from "@/lib/billing-terms";
import type { StatementSnapshot } from "@/lib/invoice-draft";

export type InvoiceLineInput = {
  sortOrder: number;
  itemType: string;
  label: string;
  description: string | null;
  unitPriceExTax: number;
  quantity: number;
  subtotalExTax: number;
  taxAmount: number;
  totalInclTax: number;
};

function line(sortOrder: number, label: string, description: string | null, amountExTax: number): InvoiceLineInput {
  const t = addTax(amountExTax);
  return { sortOrder, itemType: "SERVICE", label, description, unitPriceExTax: amountExTax, quantity: 1, subtotalExTax: amountExTax, taxAmount: t.tax, totalInclTax: t.amountIncl };
}

// 請求書の品目。
// 既定: 「業務委託費一式」1行(内訳は別紙の稼働明細書)。
// split=true(取引先の設定): 「稼働費用（スタッフ名）」をスタッフごとに、「交通費相当額」を全員分まとめて1行、
//   その他の項目(新幹線代・広告原価など)を項目名ごとに1行。金額が0の行は出さない。
// どちらでも、税抜合計(=稼働明細書の合計)は同じになる。
export function buildInvoiceLines(d: Pick<StatementSnapshot, "staff" | "clientExtras" | "manualLines">, split: boolean): InvoiceLineInput[] {
  // 品目を手入力にしているときは、その行をそのまま使う(金額は数量×単価)。
  if (d.manualLines?.length) {
    const lines = d.manualLines.map((m, i) => {
      const sub = m.quantity * m.unitPriceExTax;
      const t = addTax(sub);
      return { sortOrder: (i + 1) * 10, itemType: "SERVICE", label: m.label, description: null, unitPriceExTax: m.unitPriceExTax, quantity: m.quantity, subtotalExTax: sub, taxAmount: t.tax, totalInclTax: t.amountIncl } as InvoiceLineInput;
    });
    return adjustTax(lines);
  }
  const parts: { label: string; amount: number }[] = [];
  for (const s of d.staff) if ((s.serviceExTax ?? 0) > 0) parts.push({ label: `稼働費用（${normName(s.name)}）`, amount: s.serviceExTax });
  const travel = d.staff.reduce((sum, s) => sum + s.travel.amountExTax, 0);
  if (travel > 0) parts.push({ label: "交通費相当額", amount: travel });
  for (const s of d.staff) for (const e of s.extras ?? []) if (e.amountExTax > 0) parts.push({ label: e.label, amount: e.amountExTax });
  for (const e of d.clientExtras ?? []) if (e.amountExTax > 0) parts.push({ label: e.label, amount: e.amountExTax });

  const total = parts.reduce((sum, p) => sum + p.amount, 0);
  if (!split || parts.length === 0) return [line(10, "業務委託費一式", "内訳は別紙「稼働明細書」のとおり", total)];

  return adjustTax(parts.map((p, i) => line((i + 1) * 10, p.label, null, p.amount)));
}

// 行ごとの消費税の合計を、請求全体の消費税(合計×10%の切り捨て)に合わせる。端数は最後の行で調整する。
function adjustTax(lines: InvoiceLineInput[]): InvoiceLineInput[] {
  if (!lines.length) return lines;
  const overall = computeInvoiceTotals(lines).taxAmount;
  const diff = overall - lines.reduce((sum, l) => sum + l.taxAmount, 0);
  const last = lines[lines.length - 1];
  last.taxAmount += diff;
  last.totalInclTax = last.subtotalExTax + last.taxAmount;
  return lines;
}

// 手入力の単価(入力した金額)から、請求する税別の単価を求める。税別入力はそのまま、税込入力は税別(円未満切り捨て)に直す。
export function manualUnitExTax(mode: "EX" | "INCL", entered: number) {
  return mode === "INCL" ? splitInclusiveTax(entered).amountEx : entered;
}
