import { findExistingClient, type ClientForMatch } from "@/lib/estimate-client";
import { splitEmails } from "@/lib/invoice-defaults";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NewClientInput = { name: string; contactName?: string; phone?: string; emails: string };
export type NewClientChecked =
  | { ok: true; data: { name: string; contactName: string | null; phone: string | null; emails: string[] } }
  | { ok: false; error: string };

// 管理画面で取引先を追加するときの入力チェック(純粋なロジック。DBには触れない)。
// ・会社名は必須。メールアドレス(請求書の送信先)は空でもよい(請求書ごとに入力できる)。複数可(カンマ・改行・空白区切り)。
// ・会社名またはメールアドレスが既存の取引先と一致するときは、二重に作らず、既存の取引先名を示してエラーにする。
export function checkNewClient(input: NewClientInput, existing: ClientForMatch[]): NewClientChecked {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "会社名を入力してください。" };
  if (name.length > 100) return { ok: false, error: "会社名は100文字以内で入力してください。" };
  const emails = [...new Set(splitEmails(input.emails))];
  const bad = emails.find((e) => !EMAIL_RE.test(e));
  if (bad) return { ok: false, error: `メールアドレスの形式が正しくありません: ${bad}` };
  const found = findExistingClient(existing, name, emails);
  if (found) return { ok: false, error: `同じ会社名またはメールアドレスの取引先「${found.name}」がすでにあります。` };
  return { ok: true, data: { name, contactName: input.contactName?.trim() || null, phone: input.phone?.trim() || null, emails } };
}
