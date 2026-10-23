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

test("当月末払い(月末締め): 10/31(土)は前倒しで10/30(金)に10月分、11/30(31日指定は月末に丸め)は 11月分", () => {
  assert.equal(fixedPaymentDueToday(S(31, 0, 31), jst("2026-10-30T09:30:00"))?.closingYearMonth, "2026-10");
  assert.equal(fixedPaymentDueToday(S(31, 0, 31), jst("2026-10-31T09:30:00")), null);
  assert.equal(fixedPaymentDueToday(S(31, 0, 31), jst("2026-11-30T09:30:00"))?.closingYearMonth, "2026-11");
  assert.equal(fixedPaymentDueToday(S(31, 0, 31), jst("2026-11-29T09:30:00")), null);
});

test("翌月末払い(締日0=月末): 年またぎ 1/31(日)は1/29(金)に12月分、2月は28日(日)が2/26(金)に", () => {
  assert.equal(fixedPaymentDueToday(S(0, 1, 0), jst("2027-01-29T09:00:00"))?.closingYearMonth, "2026-12");
  assert.equal(fixedPaymentDueToday(S(0, 1, 0), jst("2027-02-26T09:00:00"))?.closingYearMonth, "2027-01");
});

test("月末以外の締日は monthEndClosing=false、未設定は null", () => {
  assert.equal(fixedPaymentDueToday(S(15, 1, 25), jst("2026-10-23T09:00:00"))?.monthEndClosing, false); // 10/25(日)は10/23(金)に前倒し
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

import { toPreviousBankBusinessDay, isBankHoliday } from "./bank-day";
import { fixedPaymentDateForClosingMonth } from "./payment";
import { summarizeAttendance } from "./attendance-summary";
import { makeJstDateOnly, toJstDateValue } from "./time";

const day = (y: number, m: number, d: number) => toJstDateValue(toPreviousBankBusinessDay(makeJstDateOnly(y, m, d)));

test("前倒し: 土日は直前の金曜、祝日は直前の営業日", () => {
  assert.equal(day(2026, 10, 24), "2026-10-23"); // 土
  assert.equal(day(2026, 10, 25), "2026-10-23"); // 日
  assert.equal(day(2026, 10, 23), "2026-10-23"); // 金(営業日)はそのまま
  assert.equal(day(2026, 11, 3), "2026-11-02"); // 文化の日(火)→月
  assert.equal(day(2026, 10, 12), "2026-10-09"); // スポーツの日(月)→前の金
});

test("前倒し: 12/29〜1/3は銀行休業日。12/31・1/1は12/28に", () => {
  assert.equal(isBankHoliday("2026-12-29"), true);
  assert.equal(isBankHoliday("2027-01-03"), true);
  assert.equal(day(2026, 12, 31), "2026-12-28"); // 月
  assert.equal(day(2027, 1, 1), "2026-12-28");
  assert.equal(day(2027, 1, 4), "2027-01-04"); // 月・営業日
});

test("固定支払の通知日: 前倒し後の日に通知される", () => {
  // 翌月25日払い(月末締め): 2026-10分は 11/25(水)。9月分は 10/25(日)→10/23(金)
  assert.equal(fixedPaymentDueToday(S(31, 1, 25), jst("2026-10-23T09:00:00"))?.closingYearMonth, "2026-09");
  assert.equal(fixedPaymentDueToday(S(31, 1, 25), jst("2026-10-25T09:00:00")), null);
  assert.equal(toJstDateValue(fixedPaymentDateForClosingMonth(S(31, 1, 25), "2026-09")!), "2026-10-23");
  // 年末: 12月分を翌月(1月)末払い=1/31(日)→1/29(金)
  assert.equal(toJstDateValue(fixedPaymentDateForClosingMonth(S(0, 1, 0), "2026-12")!), "2027-01-29");
});

test("月次集計: 出勤日数・打刻漏れ・定時超過・欠勤(申請のみ)・早退(報告のみ)", () => {
  const now = jst("2026-10-23T14:00:00");
  const shifts = [
    { id: "a", startTime: jst("2026-10-01T10:00:00") }, // 10:00開始 → 10:05打刻=定時超過
    { id: "b", startTime: jst("2026-10-02T10:00:00") }, // 10:00前に打刻=OK
    { id: "c", startTime: jst("2026-10-05T10:00:00") }, // シフトあり・打刻なし・申請なし=打刻漏れ
    { id: "d", startTime: jst("2026-10-06T10:00:00") }, // 出勤のみ=打刻漏れ
    { id: "e", startTime: jst("2026-10-23T10:00:00") }, // 当日・打刻なしは数えない
    { id: "f", startTime: jst("2026-10-07T10:00:00") }, // 欠勤申請あり・打刻なし=欠勤(打刻漏れにしない)
  ];
  const clocks = [
    { type: "IN" as const, timestamp: jst("2026-10-01T10:05:30"), shiftId: "a" },
    { type: "OUT" as const, timestamp: jst("2026-10-01T19:00:00"), shiftId: "a" },
    { type: "IN" as const, timestamp: jst("2026-10-02T09:58:00"), shiftId: "b" },
    { type: "OUT" as const, timestamp: jst("2026-10-02T19:00:00"), shiftId: "b" },
    { type: "IN" as const, timestamp: jst("2026-10-06T10:00:00"), shiftId: "d" },
  ];
  const r = summarizeAttendance({ shifts, clocks, earlyLeaveDates: ["2026-10-02", "2026-10-02"], absenceDates: ["2026-10-07"], now });
  assert.equal(r.workDays, 2);
  assert.deepEqual(r.missedClockDates, ["2026-10-05", "2026-10-06"]);
  assert.deepEqual(r.lateClockInDates, ["2026-10-01"]);
  assert.deepEqual(r.absenceDates, ["2026-10-07"]);
  assert.deepEqual(r.earlyLeaveDates, ["2026-10-02"]);
});
