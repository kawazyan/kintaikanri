import test from "node:test";
import assert from "node:assert/strict";
import { clientEmails, findExistingClient, normalizeCompanyName, type ClientForMatch } from "./estimate-client";

const c = (id: string, name: string, email: string | null, invoiceEmails: string | null, day = 1): ClientForMatch => ({
  id,
  name,
  email,
  invoiceEmails,
  updatedAt: new Date(`2026-10-0${day}T00:00:00Z`),
});

const clients = [
  c("a", "株式会社Faice", "info@faice.example", "keiri@faice.example, boss@faice.example"),
  c("b", "UG株式会社", null, null),
  c("c", "東北テレメディア株式会社", "tele@media.example", null, 5),
];

test("会社名の比較は、全角半角・空白・英字の大小を無視する", () => {
  assert.equal(normalizeCompanyName("株式会社 Faice"), normalizeCompanyName("株式会社Ｆａｉｃｅ"));
  assert.equal(normalizeCompanyName("株式会社　faice"), normalizeCompanyName("株式会社FAICE"));
  assert.notEqual(normalizeCompanyName("株式会社Faice"), normalizeCompanyName("(株)Faice"));
});

test("会社名が一致したら既存の取引先とみなす", () => {
  assert.equal(findExistingClient(clients, "ＵＧ株式会社", [])?.id, "b");
  assert.equal(findExistingClient(clients, "UG 株式会社", ["other@example.com"])?.id, "b");
});

test("会社名が違っても、メールアドレスが一致したら既存とみなす(請求用の宛先・従来のemailの両方、大小無視)", () => {
  assert.equal(findExistingClient(clients, "別名の会社", ["BOSS@faice.example"])?.id, "a");
  assert.equal(findExistingClient(clients, "別名の会社", ["tele@media.example"])?.id, "c");
});

test("会社名もメールも一致しなければ null(新規登録の対象)", () => {
  assert.equal(findExistingClient(clients, "新しい会社", ["new@example.com"]), null);
  assert.equal(findExistingClient(clients, "", []), null);
  assert.equal(findExistingClient(clients, "   ", [""]), null);
});

test("会社名の一致をメールの一致より優先し、複数一致なら更新が新しい方", () => {
  const list = [c("x", "同じ会社", "x@example.com", null, 2), c("y", "同じ会社", "y@example.com", null, 7), c("z", "別の会社", "match@example.com", null, 9)];
  assert.equal(findExistingClient(list, "同じ会社", ["match@example.com"])?.id, "y");
  assert.equal(findExistingClient(list, "その他", ["match@example.com"])?.id, "z");
});

test("取引先のメール一覧は請求用の宛先と従来のemailを合わせる", () => {
  assert.deepEqual(clientEmails(clients[0]), ["keiri@faice.example", "boss@faice.example", "info@faice.example"]);
  assert.deepEqual(clientEmails(clients[1]), []);
});
