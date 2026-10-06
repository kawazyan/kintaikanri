import test from "node:test";
import assert from "node:assert/strict";
import { buildInvoiceLines } from "./invoice-lines";
import { statementBillableExTax, type StatementSnapshot } from "./invoice-draft";

const staff = (name: string, service: number, travelEx: number) =>
  ({ name, days: 16, dates: [], places: [], carriers: [], serviceExTax: service, serviceCalc: "", travel: { mode: travelEx ? "ACTUAL" : "NONE", amountExTax: travelEx, amountInclTax: travelEx } }) as unknown as StatementSnapshot["staff"][number];

test("split=false: 業務委託費一式の1行(従来どおり)", () => {
  const d = { staff: [staff("加藤　柊", 400000, 15437)], clientExtras: [] };
  const l = buildInvoiceLines(d, false);
  assert.equal(l.length, 1);
  assert.equal(l[0].label, "業務委託費一式");
  assert.equal(l[0].unitPriceExTax, 415437);
});

test("split=true: 稼働費用（名前）と交通費相当額の2行、合計は一式と同じ", () => {
  const d = { staff: [staff("加藤　柊", 400000, 15437)], clientExtras: [] };
  const l = buildInvoiceLines(d, true);
  assert.deepEqual(l.map((x) => [x.label, x.unitPriceExTax]), [["稼働費用（加藤柊）", 400000], ["交通費相当額", 15437]]);
  assert.equal(l.reduce((s, x) => s + x.unitPriceExTax, 0), statementBillableExTax(d));
  assert.equal(l.reduce((s, x) => s + x.taxAmount, 0), 41543);
});

test("split=true: 交通費0なら交通費の行は出さない・複数人は人ごと・税の端数は合計に合わせる", () => {
  const d = { staff: [staff("A　a", 100005, 0), staff("B　b", 100005, 5)], clientExtras: [{ label: "新幹線代", amountExTax: 9, amountInclTax: 9 }] };
  const l = buildInvoiceLines(d, true);
  assert.deepEqual(l.map((x) => x.label), ["稼働費用（Aa）", "稼働費用（Bb）", "交通費相当額", "新幹線代"]);
  const total = l.reduce((s, x) => s + x.unitPriceExTax, 0);
  assert.equal(l.reduce((s, x) => s + x.taxAmount, 0), Math.floor(total / 10));
});

test("手入力の品目(manualLines): 数量×単価で行を作り、税の合計は全体の10%切り捨てに合う", () => {
  const d = { staff: [staff("加藤　柊", 400000, 15437)], clientExtras: [], manualLines: [{ label: "A", quantity: 2, unitPriceExTax: 1005 }, { label: "B", quantity: 1, unitPriceExTax: 7 }] };
  const l = buildInvoiceLines(d, true);
  assert.deepEqual(l.map((x) => [x.label, x.quantity, x.unitPriceExTax, x.subtotalExTax]), [["A", 2, 1005, 2010], ["B", 1, 7, 7]]);
  assert.equal(l.reduce((s, x) => s + x.taxAmount, 0), Math.floor(2017 / 10));
});
