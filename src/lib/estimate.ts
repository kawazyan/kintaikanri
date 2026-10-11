import { computeInvoiceTotals, splitInclusiveTax } from "@/lib/billing";
import { splitEmails } from "@/lib/invoice-defaults";

// 見積書の純粋なロジック(DB・画面に依存しない。テストできる範囲)。
// 請求書(invoice-*.ts)とは別。請求書の計算・画面・PDFには影響しない。

export type EstimateTaxMode = "EX" | "INCL";

export type EstimateLineInput = {
  label: string;
  description?: string;
  quantity: number;
  // 入力した単価。taxMode が EX なら税別、INCL なら税込。
  unitPrice: number;
};

// 必須の項目はない(取引先・宛名・件名・品目なども空のまま保存できる)。
// 入力した値の形が正しくないとき(日付・数量・単価・メールアドレス)だけ、保存できない。
export type EstimateInput = {
  clientId?: string; // 取引先(任意)
  issuedDate?: string; // YYYY-MM-DD。空なら今日(日本時間)
  addressee: string; // 宛名(会社名)
  storeName?: string; // 店舗名(宛名の下に表示)
  recipientEmails?: string; // 送信先メールアドレス(手入力。複数可。あれば取引先の登録より優先)
  subject: string;
  note?: string;
  taxMode: EstimateTaxMode;
  lines: EstimateLineInput[];
};

export const DEFAULT_ESTIMATE_SUBJECT = "お見積りに関して";

// 見積番号: KJ-見積-YYYYMM-連番(YYYYMM は発行日の年月、連番は月ごとに001から)。
export function estimateNumberPrefix(issuedDate: string) {
  return `KJ-見積-${issuedDate.slice(0, 4)}${issuedDate.slice(5, 7)}-`;
}

export function formatEstimateNumber(issuedDate: string, seq: number) {
  return `${estimateNumberPrefix(issuedDate)}${String(seq).padStart(3, "0")}`;
}

// 同じ年月の既存の見積番号から、次の連番を求める(最大値+1。欠番があっても番号は再利用しない)。
export function nextEstimateSeq(existingNumbers: string[], issuedDate: string) {
  const prefix = estimateNumberPrefix(issuedDate);
  let max = 0;
  for (const n of existingNumbers) {
    if (!n.startsWith(prefix)) continue;
    const tail = n.slice(prefix.length);
    if (!/^\d+$/.test(tail)) continue;
    max = Math.max(max, Number(tail));
  }
  return max + 1;
}

// 入力した単価から、税別単価を求める。税別入力はそのまま、税込入力は税別(円未満切り捨て)に直す。
export function estimateUnitExTax(mode: EstimateTaxMode, entered: number) {
  return mode === "INCL" ? splitInclusiveTax(entered).amountEx : entered;
}

// 小計=Σ(数量×税別単価)、消費税=小計×10%(円未満切り捨て)、合計=小計+消費税。請求書と同じ計算方式。
export function computeEstimateTotals(mode: EstimateTaxMode, lines: Pick<EstimateLineInput, "quantity" | "unitPrice">[]) {
  return computeInvoiceTotals(lines.map((l) => ({ quantity: l.quantity, unitPriceExTax: estimateUnitExTax(mode, l.unitPrice) })));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// 入力の検査。問題があれば画面に出すメッセージを返す(なければ null)。必須項目はない。
export function validateEstimateInput(input: EstimateInput): string | null {
  if (input.issuedDate?.trim() && !isRealDate(input.issuedDate.trim())) return "発行日は、正しい日付で入力してください。";
  if (input.taxMode !== "EX" && input.taxMode !== "INCL") return "単価の入力方法（税別・税込）を選んでください。";
  const badTo = splitEmails(input.recipientEmails).find((x) => !EMAIL_RE.test(x));
  if (badTo) return `送信先メールアドレスの形式が正しくありません: ${badTo}`;
  for (const l of filledLines(input.lines)) {
    const name = l.label.trim() || "（内容なし）";
    if (!Number.isInteger(l.quantity) || l.quantity < 1) return `「${name}」の数量は1以上の整数で入力してください。`;
    if (!Number.isInteger(l.unitPrice) || l.unitPrice < 0) return `「${name}」の単価は0以上の整数で入力してください。`;
  }
  return null;
}

// 何か入力のある行だけ(内容・補足・単価のどれもない行は無視する)。
export function filledLines<T extends Pick<EstimateLineInput, "label" | "unitPrice"> & { description?: string }>(lines: T[]) {
  return lines.filter((l) => l.label.trim() || l.description?.trim() || l.unitPrice);
}

// 送信先: 見積書に手入力した送信先メールアドレスがあればそれを使い、なければ取引先に登録された請求用の宛先を使う。
export function resolveEstimateRecipients(manual: string | null | undefined, clientRecipients: string[]) {
  const typed = [...new Set(splitEmails(manual))];
  return typed.length ? typed : clientRecipients;
}

// 添付PDFのファイル名。例: 御見積書_KJ-見積-202610-001_株式会社K.J.pdf(ファイル名に使えない文字は _ にする)
export function estimatePdfFileName(estimateNumber: string) {
  return `御見積書_${estimateNumber}_株式会社K.J.pdf`.replace(/[\\/:*?"<>|]/g, "_");
}
