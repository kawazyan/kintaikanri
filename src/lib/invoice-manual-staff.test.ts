import test from "node:test";
import assert from "node:assert/strict";
import { buildManualStaffNoShift, validateManualStaffNoShift } from "./invoice-manual-staff";

test("金額あり: 手入力の計算文・契約登録情報なし", () => {
  const s = buildManualStaffNoShift({ name: "森田", storeName: "テスト店", serviceExTax: 300000 });
  assert.equal(s.serviceExTax, 300000);
  assert.equal(s.serviceCalc, "手入力 ¥300,000");
  assert.equal(s.manual, undefined);
  assert.deepEqual(s.places, ["テスト店"]);
  assert.equal(s.days, 0);
});

test("金額未入力(0): 未入力と分かる文言", () => {
  const s = buildManualStaffNoShift({ name: "森田", storeName: "テスト店", serviceExTax: 0 });
  assert.match(s.serviceCalc, /未入力/);
});

test("稼働日あり: 日数・店舗(日ごと)が入る", () => {
  const s = buildManualStaffNoShift({ name: "森田", storeName: "A店", serviceExTax: 0, dates: ["2026-09-03", "2026-09-02", "2026-09-02"] });
  assert.deepEqual(s.dates, ["2026-09-02", "2026-09-03"]);
  assert.equal(s.days, 2);
  assert.deepEqual(s.dayPlaces, { "2026-09-02": "A店", "2026-09-03": "A店" });
});

test("検査: 対象月以外・存在しない日付は不可", () => {
  assert.ok(validateManualStaffNoShift({ storeName: "A", serviceExTax: 0, dates: ["2026-10-01"] }, "2026-09"));
  assert.ok(validateManualStaffNoShift({ storeName: "A", serviceExTax: 0, dates: ["2026-09-31"] }, "2026-09"));
  assert.equal(validateManualStaffNoShift({ storeName: "A", serviceExTax: 0, dates: ["2026-09-30"] }, "2026-09"), null);
});

test("検査: 店舗名なし・不正な金額は不可、金額0は可", () => {
  assert.ok(validateManualStaffNoShift({ storeName: " ", serviceExTax: 0 }));
  assert.ok(validateManualStaffNoShift({ storeName: "A", serviceExTax: -1 }));
  assert.ok(validateManualStaffNoShift({ storeName: "A", serviceExTax: 1.5 }));
  assert.equal(validateManualStaffNoShift({ storeName: "A", serviceExTax: 0 }), null);
});

import { validateExternalStaffName } from "./invoice-manual-staff";

test("勤怠に登録していない人: external=true・キャリアを請求内訳書に載せる", () => {
  const s = buildManualStaffNoShift({ name: "山田　太郎", storeName: "テスト店", serviceExTax: 0, external: true, carrier: " au " });
  assert.equal(s.external, true);
  assert.deepEqual(s.carriers, ["au"]);
  assert.equal(s.manual, undefined); // 契約には自動登録しない
  const reg = buildManualStaffNoShift({ name: "加藤　柊", storeName: "テスト店", serviceExTax: 0 });
  assert.equal(reg.external, undefined);
  assert.deepEqual(reg.carriers, []);
});

test("勤怠未登録の名前の検査: 空・同じ請求にいる・勤怠登録済みの名前はエラー", () => {
  assert.equal(validateExternalStaffName("山田　太郎", ["加藤　柊"], ["鈴木　一郎"]), null);
  assert.ok(validateExternalStaffName("  ", [], [])?.includes("入力"));
  assert.ok(validateExternalStaffName("山田太郎", ["山田　太郎"], [])?.includes("すでにこの請求"));
  assert.ok(validateExternalStaffName("鈴木 一郎", [], ["鈴木　一郎"])?.includes("勤怠に登録済み"));
  assert.ok(validateExternalStaffName("あ".repeat(51), [], [])?.includes("50文字"));
});
