export function splitInclusiveTax(amountIncl: number, taxRate = 10) {
  const amountEx = Math.floor((amountIncl * 100) / (100 + taxRate));
  return { amountEx, tax: amountIncl - amountEx, amountIncl };
}

export function addTax(amountEx: number, taxRate = 10) {
  const tax = Math.floor((amountEx * taxRate) / 100);
  return { amountEx, tax, amountIncl: amountEx + tax };
}

export const expenseLabel = (category: string) =>
  category === "TRAVEL" ? "交通費相当額" : category === "LODGING" ? "宿泊費相当額" : "その他経費";

// 請求書テンプレートの計算方式: 小計=Σ(数量×単価)、消費税=小計×10%(円未満切り捨て)、合計=小計+消費税。
// 税率は10%固定(軽減税率・非課税は使わない)。
export function computeInvoiceTotals(lines: { quantity: number; unitPriceExTax: number }[]) {
  const subtotalExTax = lines.reduce((sum, l) => sum + l.quantity * l.unitPriceExTax, 0);
  const taxAmount = Math.floor((subtotalExTax * 10) / 100);
  return { subtotalExTax, taxAmount, totalInclTax: subtotalExTax + taxAmount };
}

// 交通費の請求項目名。例: 税込1,100円 → 「交通費相当額（税込1100円）」(単価は1,000円＋税で計算)
export const travelLineLabel = (amountIncl: number) => `交通費相当額（税込${amountIncl}円）`;
