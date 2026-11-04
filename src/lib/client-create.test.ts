import test from "node:test";
import assert from "node:assert/strict";
import { checkNewClient } from "./client-create";

const ex = (name: string, email: string | null, invoiceEmails: string | null = null) => ({ id: name, name, email, invoiceEmails, updatedAt: new Date("2026-10-01") });

test("会社名とメールを入れれば追加できる(メールは複数可・重複は除く)", () => {
  const r = checkNewClient({ name: " 株式会社テスト ", contactName: " 田中 ", phone: "", emails: "a@example.com, b@example.com\na@example.com" }, []);
  assert.deepEqual(r, { ok: true, data: { name: "株式会社テスト", contactName: "田中", phone: null, emails: ["a@example.com", "b@example.com"] } });
});

test("メールは空でもよい", () => {
  const r = checkNewClient({ name: "株式会社テスト", emails: "" }, []);
  assert.ok(r.ok && r.data.emails.length === 0);
});

test("会社名が空ならエラー", () => {
  assert.deepEqual(checkNewClient({ name: "  ", emails: "a@example.com" }, []), { ok: false, error: "会社名を入力してください。" });
});

test("メールの形式が正しくなければエラー", () => {
  const r = checkNewClient({ name: "株式会社テスト", emails: "a@example.com, abc" }, []);
  assert.ok(!r.ok && r.error.includes("abc"));
});

test("同じ会社名(全角半角・空白の違いは同じ扱い)の取引先があればエラー", () => {
  const r = checkNewClient({ name: "株式会社ＵＧ", emails: "" }, [ex("株式会社UG", null)]);
  assert.ok(!r.ok && r.error.includes("株式会社UG"));
});

test("同じメールアドレスの取引先があればエラー(請求用・従来のどちらも)", () => {
  assert.ok(!checkNewClient({ name: "別会社", emails: "X@Example.com" }, [ex("既存A", null, "x@example.com")]).ok);
  assert.ok(!checkNewClient({ name: "別会社", emails: "y@example.com" }, [ex("既存B", "y@example.com")]).ok);
});

test("会社名もメールも違えば追加できる", () => {
  assert.ok(checkNewClient({ name: "別会社", emails: "z@example.com" }, [ex("既存", "a@example.com")]).ok);
});
