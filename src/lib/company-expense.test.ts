import test from "node:test";
import assert from "node:assert/strict";
import { isRealDate, parseCompanyExpense } from "./company-expense";

const base = { expenseDate: "2026-10-30", category: "家賃・事務所代", item: "ニホンセーフティー", amount: "109,418", recurring: true, memo: "" };

test("正しい入力は、月を日付から決めて受け付ける", () => {
  const r = parseCompanyExpense(base);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.yearMonth, "2026-10");
    assert.equal(r.value.amount, 109418);
    assert.equal(r.value.memo, null);
    assert.equal(r.value.recurring, true);
  }
});

test("存在しない日付・形式違いの日付はエラー", () => {
  assert.equal(isRealDate("2026-02-30"), false);
  assert.equal(isRealDate("2026-2-3"), false);
  assert.equal(isRealDate("2026-10-31"), true);
  assert.ok(!parseCompanyExpense({ ...base, expenseDate: "2026-02-30" }).ok);
});

test("区分が一覧にない・項目が空・金額が0や文字はエラー", () => {
  assert.ok(!parseCompanyExpense({ ...base, category: "交際費" }).ok);
  assert.ok(!parseCompanyExpense({ ...base, item: "  " }).ok);
  for (const a of ["0", "-5", "1.5", "abc", ""]) assert.ok(!parseCompanyExpense({ ...base, amount: a }).ok, a);
});

test("全角数字の金額も読める", () => {
  const r = parseCompanyExpense({ ...base, amount: "４５１，３１０" });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.amount, 451310);
});
