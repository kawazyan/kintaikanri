import test from "node:test";
import assert from "node:assert/strict";
import { branchAddressee, carryFromPreviousMonth, checkBranches, prevYearMonth } from "./invoice-branch";

test("宛名は「会社名　店舗名」(全角スペース)", () => {
  assert.equal(branchAddressee("株式会社コスモネット", "SB秋田山王店"), "株式会社コスモネット　SB秋田山王店");
});

test("前の月: 1月の前は前年12月", () => {
  assert.equal(prevYearMonth("2026-11"), "2026-10");
  assert.equal(prevYearMonth("2026-01"), "2025-12");
  assert.equal(prevYearMonth("2026-10"), "2026-09");
});

test("請求先(店舗)の入力チェック: 正常・メール複数・重複除去・空行は無視", () => {
  const r = checkBranches([{ label: " SB秋田山王店 ", emails: "a@example.com, b@example.com\na@example.com" }, { label: "", emails: "" }, { label: "SBフレスポ富沢店", emails: "c@example.com" }]);
  assert.deepEqual(r, { ok: true, presets: [{ label: "SB秋田山王店", emails: ["a@example.com", "b@example.com"] }, { label: "SBフレスポ富沢店", emails: ["c@example.com"] }] });
});

test("請求先(店舗)の入力チェック: 店舗名なし・メールなし・形式不正・重複はエラー", () => {
  assert.ok(!checkBranches([{ label: "", emails: "a@example.com" }]).ok);
  assert.ok(!checkBranches([{ label: "A店", emails: "" }]).ok);
  const bad = checkBranches([{ label: "A店", emails: "abc" }]); assert.ok(!bad.ok && bad.error.includes("abc"));
  const dup = checkBranches([{ label: "ＳＢ秋田山王店", emails: "a@example.com" }, { label: "sb 秋田山王店", emails: "b@example.com" }]); assert.ok(!dup.ok && dup.error.includes("重複"));
});

test("前月の引き継ぎ: 手入力の品目と税モード・共通項目を引き継ぐ(元は書き換えない)", () => {
  const prev = { manualLines: [{ label: "meta広告掲載費", quantity: 1, unitPriceExTax: 30000 }], manualTaxMode: "EX" as const, manualShowAttendance: false, clientExtras: [] };
  const c = carryFromPreviousMonth(prev);
  assert.deepEqual(c, { manualLines: prev.manualLines, manualTaxMode: "EX", manualShowAttendance: false, clientExtras: [] });
  c!.manualLines![0].unitPriceExTax = 1; assert.equal(prev.manualLines[0].unitPriceExTax, 30000);
});

test("前月の引き継ぎ: 共通項目だけの請求(広告費など)も引き継ぐ。中身がなければ null", () => {
  const ex = [{ label: "meta広告費 10月17日〜10月18日", amountExTax: 30000, amountInclTax: 33000 }];
  assert.deepEqual(carryFromPreviousMonth({ clientExtras: ex }), { clientExtras: ex });
  assert.equal(carryFromPreviousMonth({ clientExtras: [] }), null);
  assert.equal(carryFromPreviousMonth(null), null);
});
