// 請求書テンプレート(K.J 請求書テンプレート.xlsx)の固定文言。
export const INVOICE_REGISTRATION_NUMBER = "T8370001045322";

// 「振込先情報・備考」欄の既定文(テンプレートのとおり)。請求ごとに修正画面で変更できる。
export const DEFAULT_INVOICE_NOTE = [
  "いつも大変お世話になっております。",
  "",
  "お支払い期限：　当請求書発行日の翌月末日までにお願い致します。",
  "振込先：　paypay銀行　ビジネス営業所　3596034　カ）ケイジェイ",
  "※お振込み手数料は御社ご負担にてお願いいたします。",
].join("\n");

export const defaultSubject = (yearMonth: string) => {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${y}年${m}月請求に関して`;
};

// 稼働月(YYYY-MM)の月末日(YYYY-MM-DD)。請求書の発行日はこの日付にする。
export function monthEndOf(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// 発行日(JST日付 YYYY-MM-DD)の翌月末日(YYYY-MM-DD)。
export function nextMonthEnd(issueDate: string) {
  const [y, m] = issueDate.split("-").map(Number);
  const d = new Date(Date.UTC(y, m + 1, 0)); // 翌月の0日 = 翌月末
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// メールアドレスの区切り(カンマ・セミコロン・読点・空白・改行)で分ける。
export function splitEmails(raw: string | null | undefined) {
  return (raw ?? "")
    .split(/[,;、\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// 請求書メールの宛先。請求用の宛先(invoiceEmails)があればそれを、なければ従来の email を使う。重複は除く。
export function invoiceRecipients(client: { invoiceEmails?: string | null; email?: string | null }) {
  const list = splitEmails(client.invoiceEmails);
  return [...new Set(list.length ? list : splitEmails(client.email))];
}
