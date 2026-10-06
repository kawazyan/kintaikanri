import test from "node:test";
import assert from "node:assert/strict";
import { invoiceMismatch } from "./invoice-consistency";
import type { StatementSnapshot } from "./invoice-draft";

const st = (service: number, travelEx: number, manual?: StatementSnapshot["manualLines"]) =>
  ({ clientName: "x", yearMonth: "2026-09", clientExtras: [], manualLines: manual, staff: [{ name: "a", days: 1, dates: [], places: [], carriers: [], serviceExTax: service, serviceCalc: "", travel: { mode: "ACTUAL", amountExTax: travelEx, amountInclTax: travelEx } }] }) as unknown as StatementSnapshot;
const inv = (sub: number, lines: [number, number][]) => ({ subtotalExTax: sub, taxAmount: Math.floor(sub / 10), totalInclTax: sub + Math.floor(sub / 10), lines: lines.map(([q, u], i) => ({ label: `l${i}`, quantity: q, unitPriceExTax: u, subtotalExTax: q * u })) });

test("一致していれば null(自動・手入力とも)", () => {
  assert.equal(invoiceMismatch(inv(415437, [[1, 415437]]), st(400000, 15437)), null);
  assert.equal(invoiceMismatch(inv(415437, [[1, 400000], [1, 15437]]), st(400000, 15437, [{ label: "a", quantity: 1, unitPriceExTax: 400000 }, { label: "b", quantity: 1, unitPriceExTax: 15437 }])), null);
});
test("請求書の小計と内訳書の合計が違えば理由を返す", () => {
  assert.match(invoiceMismatch(inv(415436, [[1, 415436]]), st(400000, 15437))!, /請求内訳書の合計/);
});
test("消費税・品目の合計が合わなければ理由を返す", () => {
  const bad = { ...inv(415437, [[1, 415437]]), taxAmount: 41544 };
  assert.match(invoiceMismatch(bad, null)!, /消費税/);
  assert.match(invoiceMismatch(inv(100, [[1, 99]]), null)!, /品目の合計/);
});
