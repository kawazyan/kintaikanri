import test from "node:test";
import assert from "node:assert/strict";
import { invoiceTargetClientIds } from "./monthly-invoice-targets";

const rule = (over: object = {}) => ({ staffName: "A", contract: "MONTHLY", rateExTax: 300000, ...over });
const client = (id: string, billingTerms: unknown, active = true) => ({ id, active, billingTerms });

test("稼働依頼がなくても、その月に有効な契約ルールがある取引先は対象", () => {
  assert.deepEqual(invoiceTargetClientIds([], [client("c1", { shiftBilling: [rule()] })], "2026-10"), ["c1"]);
});

test("稼働依頼のある取引先は従来どおり対象(契約ルールと重複しても1回)", () => {
  assert.deepEqual(invoiceTargetClientIds(["c1"], [client("c1", { shiftBilling: [rule()] })], "2026-10"), ["c1"]);
  assert.deepEqual(invoiceTargetClientIds(["c9"], [], "2026-10"), ["c9"]);
});

test("契約ルールがない・billingTermsが空・利用停止の取引先は対象外", () => {
  const cs = [client("a", null), client("b", {}), client("c", { shiftBilling: [] }), client("d", { shiftBilling: [rule()] }, false)];
  assert.deepEqual(invoiceTargetClientIds([], cs, "2026-10"), []);
});

test("適用期間(fromMonth/toMonth)の外の契約ルールは対象外", () => {
  const cs = [client("x", { shiftBilling: [rule({ fromMonth: "2026-11" })] }), client("y", { shiftBilling: [rule({ toMonth: "2026-09" })] }), client("z", { shiftBilling: [rule({ fromMonth: "2026-10", toMonth: "2026-10" })] })];
  assert.deepEqual(invoiceTargetClientIds([], cs, "2026-10"), ["z"]);
});
