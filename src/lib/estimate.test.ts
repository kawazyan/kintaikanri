import test from "node:test";
import assert from "node:assert/strict";
import {
  computeEstimateTotals,
  defaultEstimateSubject,
  estimateNumberPrefix,
  estimatePdfFileName,
  estimateUnitExTax,
  filledLines,
  formatEstimateNumber,
  isRealDate,
  nextEstimateSeq,
  resolveEstimateRecipients,
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

test("必須項目はない(取引先・宛名・件名・店舗名・送信先・発行日・品目が全て空でも保存できる)", () => {
  assert.equal(validateEstimateInput({ addressee: "", subject: "", taxMode: "EX", lines: [] }), null);
  assert.equal(validateEstimateInput({ ...base, clientId: undefined, issuedDate: "", addressee: "", subject: "", storeName: "", recipientEmails: "", lines: [] }), null);
  // 内容(品名)がなくても、単価だけの行は保存できる
  assert.equal(validateEstimateInput({ ...base, lines: [{ label: "", quantity: 1, unitPrice: 100 }] }), null);
});

test("入力した値の形が正しくないときだけ理由を返す", () => {
  assert.match(validateEstimateInput({ ...base, issuedDate: "2026-02-30" })!, /発行日/);
  assert.match(validateEstimateInput({ ...base, recipientEmails: "abc" })!, /送信先メールアドレス/);
  assert.match(validateEstimateInput({ ...base, recipientEmails: "a@example.com, bad" })!, /bad/);
  assert.match(validateEstimateInput({ ...base, lines: [{ label: "a", quantity: 0, unitPrice: 100 }] })!, /数量/);
  assert.match(validateEstimateInput({ ...base, lines: [{ label: "a", quantity: 1, unitPrice: -1 }] })!, /単価/);
  assert.match(validateEstimateInput({ ...base, lines: [{ label: "a", quantity: 1, unitPrice: 1.5 }] })!, /単価/);
});

test("送信先メールアドレスは複数(カンマ・読点・改行区切り)を受け付ける", () => {
  assert.equal(validateEstimateInput({ ...base, recipientEmails: "a@example.com, b@example.co.jp\nc@example.com" }), null);
});

test("何か入力のある行だけを対象にする", () => {
  const rows = [
    { label: "", quantity: 1, unitPrice: 0 },
    { label: "a", quantity: 1, unitPrice: 0 },
    { label: "", description: "補足のみ", quantity: 1, unitPrice: 0 },
    { label: "", quantity: 1, unitPrice: 5 },
  ];
  assert.equal(filledLines(rows).length, 3);
});

test("送信先: 手入力があればそれを使い、なければ取引先の登録を使う", () => {
  assert.deepEqual(resolveEstimateRecipients("x@example.com, y@example.com", ["reg@example.com"]), ["x@example.com", "y@example.com"]);
  assert.deepEqual(resolveEstimateRecipients("x@example.com, x@example.com", []), ["x@example.com"]);
  assert.deepEqual(resolveEstimateRecipients("", ["reg@example.com"]), ["reg@example.com"]);
  assert.deepEqual(resolveEstimateRecipients(null, ["reg@example.com"]), ["reg@example.com"]);
  assert.deepEqual(resolveEstimateRecipients("  ", []), []);
});

test("PDFファイル名", () => {
  assert.equal(estimatePdfFileName("KJ-見積-202610-001"), "御見積書_KJ-見積-202610-001_株式会社K.J.pdf");
});

test("件名の自動入力は「発行日の翌月」(12月は1月、正しくない日付は空)", () => {
  assert.equal(defaultEstimateSubject("2026-10-12"), "11月分お見積りに関して");
  assert.equal(defaultEstimateSubject("2026-12-31"), "1月分お見積りに関して");
  assert.equal(defaultEstimateSubject("2026-01-01"), "2月分お見積りに関して");
  assert.equal(defaultEstimateSubject("2026-11-30"), "12月分お見積りに関して");
  assert.equal(defaultEstimateSubject(""), "");
  assert.equal(defaultEstimateSubject("2026-02-30"), "");
  assert.equal(defaultEstimateSubject(null), "");
});
