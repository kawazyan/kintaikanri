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
