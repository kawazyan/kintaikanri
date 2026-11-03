import test from "node:test";
import assert from "node:assert/strict";
import { countDays, dailyRateOf, nextFreeDate, orderDatesForEdit, recalcDailyService, sortDates } from "./invoice-daily";

test("新しい下書き: dailyRateExTax があればそれを日額にする", () => {
  assert.deepEqual(recalcDailyService({ dailyRateExTax: 20000, serviceCalc: "日額 ¥20,000 × 3日" }, 5), {
    serviceExTax: 100000,
    serviceCalc: "日額 ¥20,000 × 5日",
  });
});

test("以前の下書き: 計算方法の文から日額を読み取る", () => {
  assert.deepEqual(recalcDailyService({ serviceCalc: "日額 ¥18,500 × 4日" }, 6), {
    serviceExTax: 111000,
    serviceCalc: "日額 ¥18,500 × 6日",
  });
});

test("末尾の一言(例: 16稼働)は残す", () => {
  const r = recalcDailyService({ dailyRateExTax: 15000, serviceCalc: "日額 ¥15,000 × 16日（16稼働）" }, 17);
  assert.equal(r?.serviceExTax, 255000);
  assert.equal(r?.serviceCalc, "日額 ¥15,000 × 17日（16稼働）");
});

test("稼働日を減らす・0日にもできる", () => {
  assert.equal(recalcDailyService({ dailyRateExTax: 20000, serviceCalc: "日額 ¥20,000 × 3日" }, 2)?.serviceExTax, 40000);
  assert.deepEqual(recalcDailyService({ dailyRateExTax: 20000, serviceCalc: "日額 ¥20,000 × 3日" }, 0), {
    serviceExTax: 0,
    serviceCalc: "日額 ¥20,000 × 0日",
  });
});

test("月額の契約・手入力は自動で変えない(null)", () => {
  assert.equal(dailyRateOf({ serviceCalc: "月額 ¥400,000" }), null);
  assert.equal(dailyRateOf({ serviceCalc: "月額 ¥400,000 ÷ 予定20日 = 1日 ¥20,000 × 18日" }), null);
  assert.equal(dailyRateOf({ serviceCalc: "月額 ¥400,000（固定）" }), null);
  assert.equal(dailyRateOf({ serviceCalc: "手入力 ¥50,000" }), null);
  assert.equal(recalcDailyService({ serviceCalc: "月額 ¥400,000" }, 5), null);
});

test("当日単価変更を含む請求は日数だけでは決まらないので自動で変えない", () => {
  assert.equal(dailyRateOf({ dailyRateExTax: 20000, serviceCalc: "日額 ¥20,000 × 3日（承認済みの当日単価変更を含む）" }), null);
  assert.equal(dailyRateOf({ serviceCalc: "日額 ¥20,000 × 3日（承認済みの当日単価変更を含む）" }), null);
});

test("日額が0・不正なら null", () => {
  assert.equal(dailyRateOf({ dailyRateExTax: 0, serviceCalc: "日額 ¥0 × 3日" }), null);
  assert.equal(dailyRateOf({ dailyRateExTax: 12.5, serviceCalc: "日額 ¥13 × 3日" }), null);
});

test("sortDates: 昇順・重複と空欄を除く", () => {
  assert.deepEqual(sortDates(["2026-09-20", "2026-09-03", "", "2026-09-20", " 2026-09-11 "]), ["2026-09-03", "2026-09-11", "2026-09-20"]);
});

test("orderDatesForEdit: 入力済みは昇順、空欄(入力途中)は末尾に残す・重複は消さない", () => {
  assert.deepEqual(orderDatesForEdit(["2026-09-20", "", "2026-09-03", "2026-09-20"]), ["2026-09-03", "2026-09-20", "2026-09-20", ""]);
});

test("countDays: 空欄と重複を除いた日数", () => {
  assert.equal(countDays(["2026-09-20", "", "2026-09-03", "2026-09-20"]), 2);
  assert.equal(countDays([]), 0);
});

test("nextFreeDate: 使っていない最初の日。全部使っていれば月末日", () => {
  assert.equal(nextFreeDate("2026-09", []), "2026-09-01");
  assert.equal(nextFreeDate("2026-09", ["2026-09-01", "2026-09-02"]), "2026-09-03");
  const all = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
  assert.equal(nextFreeDate("2026-09", all), "2026-09-30");
  assert.equal(nextFreeDate("2026-02", ["2026-02-01"]), "2026-02-02");
});
