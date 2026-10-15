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

test("検査: 店舗名なし・不正な金額は不可、金額0は可", () => {
  assert.ok(validateManualStaffNoShift({ storeName: " ", serviceExTax: 0 }));
  assert.ok(validateManualStaffNoShift({ storeName: "A", serviceExTax: -1 }));
  assert.ok(validateManualStaffNoShift({ storeName: "A", serviceExTax: 1.5 }));
  assert.equal(validateManualStaffNoShift({ storeName: "A", serviceExTax: 0 }), null);
});
