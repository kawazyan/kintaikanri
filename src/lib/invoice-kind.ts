// 請求の種類。
// WORK  = 稼働分の請求(従来どおり。月ごと・取引先ごとに版(訂正版)を管理する)
// EXTRA = 別途請求(営業協力費など、スタッフの稼働とは別の請求)。稼働明細書はなく、品目は手入力。
//         同じ月に稼働分の請求があっても、版管理・月初の自動作成・修正の引き継ぎには影響しない。
export const INVOICE_KIND_WORK = "WORK";
export const INVOICE_KIND_EXTRA = "EXTRA";

export const isExtraInvoice = (kind: string | null | undefined) => kind === INVOICE_KIND_EXTRA;

// 別途請求の請求番号: KJ-202609-X123456(訂正版は末尾に -R2)。稼働分の請求番号(KJ-202609-123456)と区別する。
export const extraInvoiceNumber = (yearMonth: string, now: number = Date.now()) => `KJ-${yearMonth.replace("-", "")}-X${String(now).slice(-6)}`;

// 訂正版の印(-R2 など)を除いた請求番号。別途請求の「同じ請求の版」を見つけるのに使う。
export const invoiceFamilyBase = (invoiceNumber: string) => invoiceNumber.replace(/-R\d+$/, "");

// 別途請求の件名: 「9月分営業協力費請求に関して」
export function extraSubject(yearMonth: string, label: string) {
  const m = Number(yearMonth.split("-")[1]);
  return `${m}月分${label.trim()}請求に関して`;
}

// 別途請求の「振込先情報・備考」の既定文。稼働分の既定文にある「請求内訳書は別途添付」は、別途請求には内訳書がないので入れない。
export const DEFAULT_EXTRA_INVOICE_NOTE = [
  "いつも大変お世話になっております。",
  "",
  "※お振込み手数料は御社ご負担にてお願いいたします。",
].join("\n");

// メールの件名・添付ファイル名に入れる品目名(請求書の最初の品目。改行は除く)。
export function extraTitleOf(lines: { label: string }[]) {
  return (lines[0]?.label ?? "").replace(/\s+/g, " ").trim();
}
