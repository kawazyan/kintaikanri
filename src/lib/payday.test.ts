import test from "node:test";
import assert from "node:assert/strict";
import { fixedPaymentDueToday } from "./payment";
import { paydayMessage } from "./payday-message";

const jst = (iso: string) => new Date(`${iso}+09:00`);
const S = (closing: number, offset: number, day: number) => ({ fixedClosingDay: closing, fixedPaymentMonthOffset: offset, fixedPaymentDay: day });

test("翌月20日払い(月末締め): 10/20 は 9月分", () => {
  assert.deepEqual(fixedPaymentDueToday(S(31, 1, 20), jst("2026-10-20T09:00:00")), { closingYearMonth: "2026-09", monthEndClosing: true });
  assert.equal(fixedPaymentDueToday(S(31, 1, 20), jst("2026-10-21T09:00:00")), null);
});

test("当月末払い(月末締め): 10/31 は 10月分、11/30(31日指定は月末に丸め)は 11月分", () => {
  assert.equal(fixedPaymentDueToday(S(31, 0, 31), jst("2026-10-31T09:30:00"))?.closingYearMonth, "2026-10");
  assert.equal(fixedPaymentDueToday(S(31, 0, 31), jst("2026-11-30T09:30:00"))?.closingYearMonth, "2026-11");
  assert.equal(fixedPaymentDueToday(S(31, 0, 31), jst("2026-11-29T09:30:00")), null);
});

test("翌月末払い(締日0=月末): 年またぎ 1/31 は 12月分、2月は28日", () => {
  assert.equal(fixedPaymentDueToday(S(0, 1, 0), jst("2027-01-31T09:00:00"))?.closingYearMonth, "2026-12");
  assert.equal(fixedPaymentDueToday(S(0, 1, 0), jst("2027-02-28T09:00:00"))?.closingYearMonth, "2027-01");
});

test("月末以外の締日は monthEndClosing=false、未設定は null", () => {
  assert.equal(fixedPaymentDueToday(S(15, 1, 25), jst("2026-10-25T09:00:00"))?.monthEndClosing, false);
  assert.equal(fixedPaymentDueToday({ fixedClosingDay: null, fixedPaymentMonthOffset: null, fixedPaymentDay: null }, jst("2026-10-25T09:00:00")), null);
});

test("通知文: 固定・申請をまとめ、合計と未確定の注記", () => {
  const m = paydayMessage("2026/10/31(土)", [
    { kind: "FIXED", name: "森田　千尋", amount: 487500, note: "10月分" },
    { kind: "FIXED", name: "亀井　良祐", amount: null, note: "10月分" },
    { kind: "REQUEST", name: "加藤　柊", amount: 12000 },
  ], "https://example.com/p");
  assert.match(m, /^【本日の振込日】2026\/10\/31\(土\)\n3名/);
  assert.match(m, /■固定支払\n・森田 千尋 ¥487,500（10月分）\n・亀井 良祐 金額未確定（10月分）/);
  assert.match(m, /■申請支払（希望振込日）\n・加藤 柊 ¥12,000/);
  assert.match(m, /合計 ¥499,500（金額未確定の分を除く）/);
});
