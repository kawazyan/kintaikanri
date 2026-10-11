import test from "node:test";
import assert from "node:assert/strict";
import {
  computeEstimateTotals,
  estimateNumberPrefix,
  estimatePdfFileName,
  estimateUnitExTax,
  formatEstimateNumber,
  isRealDate,
  nextEstimateSeq,
  validateEstimateInput,
  type EstimateInput,
} from "./estimate";

const base: EstimateInput = {
  clientId: "c1",
  issuedDate: "2026-10-11",
  addressee: "株式会社テスト",
  subject: "お見積りに関して",
  taxMode: "EX",
  lines: [{ label: "業務委託費", quantity: 1, unitPrice: 400000 }],
};

test("見積番号は KJ-見積-YYYYMM-連番(3桁)", () => {
  assert.equal(estimateNumberPrefix("2026-10-11"), "KJ-見積-202610-");
  assert.equal(formatEstimateNumber("2026-10-11", 1), "KJ-見積-202610-001");
  assert.equal(formatEstimateNumber("2026-10-11", 12), "KJ-見積-202610-012");
  assert.equal(formatEstimateNumber("2026-01-05", 1000), "KJ-見積-202601-1000");
});

test("連番は同じ年月の最大値+1(別の月・別形式は無視、欠番は再利用しない)", () => {
  assert.equal(nextEstimateSeq([], "2026-10-11"), 1);
  assert.equal(nextEstimateSeq(["KJ-見積-202610-001", "KJ-見積-202610-002"], "2026-10-30"), 3);
  assert.equal(nextEstimateSeq(["KJ-見積-202610-001", "KJ-見積-202610-005"], "2026-10-30"), 6);
  assert.equal(nextEstimateSeq(["KJ-見積-202609-009", "KJ-202610-927113"], "2026-10-11"), 1);
  assert.equal(nextEstimateSeq(["KJ-見積-202610-abc"], "2026-10-11"), 1);
});

test("税別入力の合計: 消費税 = floor(小計×10%)", () => {
  assert.deepEqual(computeEstimateTotals("EX", [{ quantity: 1, unitPrice: 400000 }, { quantity: 1, unitPrice: 15437 }]), {
    subtotalExTax: 415437,
    taxAmount: 41543,
    totalInclTax: 456980,
  });
  assert.deepEqual(computeEstimateTotals("EX", [{ quantity: 3, unitPrice: 333 }]), { subtotalExTax: 999, taxAmount: 99, totalInclTax: 1098 });
});

test("税込入力は税別 floor(税込×100/110) に直してから計算する(税込16,980 → 15,436)", () => {
  assert.equal(estimateUnitExTax("INCL", 16980), 15436);
  assert.equal(estimateUnitExTax("EX", 15437), 15437);
  assert.deepEqual(computeEstimateTotals("INCL", [{ quantity: 1, unitPrice: 16980 }]), { subtotalExTax: 15436, taxAmount: 1543, totalInclTax: 16979 });
  // 税別15,437 → 税込16,980
  assert.equal(computeEstimateTotals("EX", [{ quantity: 1, unitPrice: 15437 }]).totalInclTax, 16980);
});

test("日付の検査(実在しない日付は不可)", () => {
  assert.equal(isRealDate("2026-10-11"), true);
  assert.equal(isRealDate("2026-02-29"), false);
  assert.equal(isRealDate("2026-2-9"), false);
});

test("入力が正しければ null", () => {
  assert.equal(validateEstimateInput(base), null);
  // 空の行は無視される
  assert.equal(validateEstimateInput({ ...base, lines: [...base.lines, { label: "", quantity: 1, unitPrice: 0 }] }), null);
});

test("入力の誤りは理由を返す", () => {
  assert.match(validateEstimateInput({ ...base, clientId: "" })!, /取引先/);
  assert.match(validateEstimateInput({ ...base, issuedDate: "2026-02-30" })!, /発行日/);
  assert.match(validateEstimateInput({ ...base, addressee: " " })!, /宛名/);
  assert.match(validateEstimateInput({ ...base, subject: "" })!, /件名/);
  assert.match(validateEstimateInput({ ...base, lines: [] })!, /品目を1行以上/);
  assert.match(validateEstimateInput({ ...base, lines: [{ label: "", quantity: 1, unitPrice: 100 }] })!, /名前のない行/);
  assert.match(validateEstimateInput({ ...base, lines: [{ label: "a", quantity: 0, unitPrice: 100 }] })!, /数量/);
  assert.match(validateEstimateInput({ ...base, lines: [{ label: "a", quantity: 1, unitPrice: -1 }] })!, /単価/);
  assert.match(validateEstimateInput({ ...base, lines: [{ label: "a", quantity: 1, unitPrice: 1.5 }] })!, /単価/);
});

test("PDFファイル名", () => {
  assert.equal(estimatePdfFileName("KJ-見積-202610-001"), "御見積書_KJ-見積-202610-001_株式会社K.J.pdf");
});
