import { randomBytes } from "node:crypto";

// 「金額入力フォーム」: 取引先ごとの専用リンクから、対象月と税抜金額を入れると、請求書を作って承認し、すぐ送信する仕組み。
// リンクの合言葉(token)は、取引先の請求設定(billingTerms.amountEntry)に保存する。
export const AMOUNT_ENTRY_ITEM_LABEL = "業務委託費一式";
export const AMOUNT_ENTRY_MAX_EX = 100_000_000;

export type AmountEntryConfig = { token: string; approverName: string };

export function amountEntryOf(billingTerms: unknown): AmountEntryConfig | null {
  const v = (billingTerms as { amountEntry?: { token?: unknown; approverName?: unknown } } | null)?.amountEntry;
  if (!v || typeof v.token !== "string" || !v.token || typeof v.approverName !== "string" || !v.approverName) return null;
  return { token: v.token, approverName: v.approverName };
}

export function newAmountEntryToken() {
  return randomBytes(24).toString("base64url");
}

// 対象月(YYYY-MM)と税抜金額(整数)の確認。問題なければ null、あれば画面に出す文章を返す。
export function validateAmountEntry(yearMonth: string, amountExTax: number): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth)) return "対象月を選んでください。";
  if (!Number.isInteger(amountExTax) || amountExTax < 1 || amountExTax > AMOUNT_ENTRY_MAX_EX) {
    return `金額（税抜）は1円以上${AMOUNT_ENTRY_MAX_EX.toLocaleString("ja-JP")}円以下の整数で入力してください。`;
  }
  return null;
}
