import assert from "node:assert/strict";
import test from "node:test";
import { otherClientContracts } from "./billing-terms";

const rule = (o: object) => ({ staffName: "山田　太郎", contract: "MONTHLY", rateExTax: 1, ...o });
const client = (id: string, name: string, rules: object[]) => ({ id, name, billingTerms: { shiftBilling: rules } });

test("他社にも契約があっても、店舗が重ならなければ警告のみ(掛け持ち可)", () => {
  const r = otherClientContracts([client("a", "A社", [rule({ storeMatch: ["古川"] })])], "me", "2026-09", "山田 太郎", "仙台青葉");
  assert.deepEqual(r, { others: ["A社"], conflict: null });
});
test("同じ店舗で重なる、または店舗指定なしの他社契約は競合", () => {
  assert.equal(otherClientContracts([client("a", "A社", [rule({ storeMatch: ["仙台青葉"] })])], "me", "2026-09", "山田太郎", "ヤマダ 仙台青葉").conflict, "A社");
  assert.equal(otherClientContracts([client("a", "A社", [rule({})])], "me", "2026-09", "山田太郎", "X店").conflict, "A社");
});
test("日付指定のみの他社契約は、店舗が重ならなければ競合にしない。自社・期間外は無視", () => {
  assert.equal(otherClientContracts([client("a", "A社", [rule({ dates: ["2026-09-03"] })])], "me", "2026-09", "山田太郎", "X店").conflict, null);
  assert.deepEqual(otherClientContracts([client("me", "自社", [rule({})]), client("b", "B社", [rule({ fromMonth: "2026-10" })])], "me", "2026-09", "山田太郎", "X店"), { others: [], conflict: null });
});
