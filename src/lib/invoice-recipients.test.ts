import test from "node:test";
import assert from "node:assert/strict";
import { resolveInvoiceRecipients } from "./invoice-defaults";

const client = { invoiceEmails: "a@client.example, b@client.example", email: "main@client.example" };

test("請求書に手入力の送信先があれば、取引先の登録より優先する", () => {
  assert.deepEqual(resolveInvoiceRecipients("store@client.example, boss@client.example", client), ["store@client.example", "boss@client.example"]);
});

test("手入力が空なら、取引先の請求用の宛先を使う", () => {
  assert.deepEqual(resolveInvoiceRecipients(null, client), ["a@client.example", "b@client.example"]);
  assert.deepEqual(resolveInvoiceRecipients("  ", client), ["a@client.example", "b@client.example"]);
});

test("取引先の請求用の宛先がなければ、従来のemailを使う", () => {
  assert.deepEqual(resolveInvoiceRecipients(undefined, { invoiceEmails: null, email: "main@client.example" }), ["main@client.example"]);
});

test("手入力の重複は1件にまとめる", () => {
  assert.deepEqual(resolveInvoiceRecipients("x@a.example, x@a.example", client), ["x@a.example"]);
});
