import { statementBillableExTax, type StatementSnapshot } from "@/lib/invoice-draft";

type InvoiceForCheck = {
  subtotalExTax: number;
  taxAmount: number;
  totalInclTax: number;
  lines: { label: string; quantity: number; unitPriceExTax: number; subtotalExTax: number }[];
};

// 請求書(品目・合計)と請求内訳書(稼働明細書)の金額が一致しているか確認する。一致していれば null、違えば理由の文章を返す。
// - 請求書の品目の合計(数量×単価) = 請求書の小計
// - 消費税 = 小計の10%(円未満切り捨て)、合計 = 小計 + 消費税
// - 請求内訳書の合計(手入力なら手入力の表、自動なら全スタッフ・全項目の合計) = 請求書の小計
export function invoiceMismatch(inv: InvoiceForCheck, statement: StatementSnapshot | null): string | null {
  const problems: string[] = [];
  const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
  const linesSum = inv.lines.reduce((s, l) => s + l.quantity * l.unitPriceExTax, 0);
  if (inv.lines.some((l) => l.quantity * l.unitPriceExTax !== l.subtotalExTax)) problems.push("請求書の品目の金額（数量×単価）が合っていません");
  if (linesSum !== inv.subtotalExTax) problems.push(`請求書の品目の合計（税抜 ${yen(linesSum)}）と小計（税抜 ${yen(inv.subtotalExTax)}）が違います`);
  const tax = Math.floor((inv.subtotalExTax * 10) / 100);
  if (inv.taxAmount !== tax || inv.totalInclTax !== inv.subtotalExTax + tax) problems.push(`消費税・合計が小計から計算した金額（消費税 ${yen(tax)}、税込 ${yen(inv.subtotalExTax + tax)}）と違います`);
  if (statement) {
    const stmt = statement.manualLines?.length ? statement.manualLines.reduce((s, l) => s + l.quantity * l.unitPriceExTax, 0) : statementBillableExTax(statement);
    if (stmt !== inv.subtotalExTax) problems.push(`請求内訳書の合計（税抜 ${yen(stmt)}）と請求書の小計（税抜 ${yen(inv.subtotalExTax)}）が違います`);
  }
  return problems.length ? `請求書と請求内訳書の金額が一致していません。${problems.join("。")}。「修正」画面を開いて、保存し直してください。` : null;
}
