import { test } from "node:test";
import assert from "node:assert/strict";
import { amountEntryOf, validateAmountEntry, newAmountEntryToken } from "./amount-entry";

test("請求設定から合言葉と承認者名を読む。なければnull", () => {
  assert.deepEqual(amountEntryOf({ amountEntry: { token: "abc", approverName: "森田　千尋" } }), { token: "abc", approverName: "森田　千尋" });
  assert.equal(amountEntryOf({}), null);
  assert.equal(amountEntryOf({ amountEntry: { token: "", approverName: "x" } }), null);
  assert.equal(amountEntryOf(null), null);
});

test("対象月と金額の確認", () => {
  assert.equal(validateAmountEntry("2026-11", 650000), null);
  assert.ok(validateAmountEntry("2026-13", 650000));
  assert.ok(validateAmountEntry("2026-11", 0));
  assert.ok(validateAmountEntry("2026-11", 1.5));
  assert.ok(validateAmountEntry("2026-11", 100_000_001));
});

test("合言葉は毎回違う値になる", () => {
  assert.notEqual(newAmountEntryToken(), newAmountEntryToken());
});
