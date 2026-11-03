import test from "node:test";
import assert from "node:assert/strict";
import { extraInvoiceNumber, extraSubject, extraTitleOf, invoiceFamilyBase, isExtraInvoice } from "./invoice-kind";

test("isExtraInvoice: EXTRAだけ true(既存のWORK・未設定は false)", () => {
  assert.equal(isExtraInvoice("EXTRA"), true);
  assert.equal(isExtraInvoice("WORK"), false);
  assert.equal(isExtraInvoice(undefined), false);
  assert.equal(isExtraInvoice(null), false);
});

test("extraInvoiceNumber: 稼働分(KJ-202609-123456)と区別できる", () => {
  assert.equal(extraInvoiceNumber("2026-09", 1700000123456), "KJ-202609-X123456");
});

test("invoiceFamilyBase: 訂正版の印(-R2)を除く", () => {
  assert.equal(invoiceFamilyBase("KJ-202609-X123456"), "KJ-202609-X123456");
  assert.equal(invoiceFamilyBase("KJ-202609-X123456-R2"), "KJ-202609-X123456");
  assert.equal(invoiceFamilyBase("KJ-202609-X123456-R12"), "KJ-202609-X123456");
});

test("extraSubject: 9月分営業協力費請求に関して(月は先頭の0を付けない)", () => {
  assert.equal(extraSubject("2026-09", "営業協力費"), "9月分営業協力費請求に関して");
  assert.equal(extraSubject("2026-12", " 営業協力費 "), "12月分営業協力費請求に関して");
});

test("extraTitleOf: 最初の品目名(改行は空白にする)", () => {
  assert.equal(extraTitleOf([{ label: "営業協力費" }, { label: "別の品目" }]), "営業協力費");
  assert.equal(extraTitleOf([{ label: "営業協力費\n9月分" }]), "営業協力費 9月分");
  assert.equal(extraTitleOf([]), "");
});
