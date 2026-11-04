import { splitEmails } from "@/lib/invoice-defaults";
import type { StatementExtra, StatementSnapshot } from "@/lib/invoice-draft";

// 取引先の中の「請求先(店舗など)」。同じ会社(例: コスモネット)でも、店舗ごとに宛名・送信先が違い、請求書も店舗ごとに別々に作る。
// 登録内容は Client.billingTerms.recipientPresets(店舗名＋送信先メール)。請求書には Invoice.branch に店舗名を入れる。

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 宛名: 「株式会社コスモネット　SB秋田山王店」(会社名と店舗名の間は全角スペース。「御中」は請求書側で付く)
export const branchAddressee = (clientName: string, branch: string) => `${clientName.trim()}　${branch.trim()}`;

// 前の月(YYYY-MM)。1月の前は前年12月。
export function prevYearMonth(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

// 店舗名の比較用(全角半角・空白・大文字小文字の違いは同じ扱い)
export const normBranch = (s: string) => s.normalize("NFKC").replace(/\s+/g, "").toLowerCase();

export type BranchInput = { label: string; emails: string };
export type BranchesChecked = { ok: true; presets: { label: string; emails: string[] }[] } | { ok: false; error: string };

// 取引先の画面で「請求先(店舗)」を保存するときの入力チェック(純粋なロジック)。
// ・店舗名は必須で、同じ名前(全角半角・空白の違いを除く)は重複不可。送信先メールは1件以上必須。メールの形式を確認し、重複は除く。
// ・空の行(店舗名もメールも空)は無視する。
export function checkBranches(input: BranchInput[]): BranchesChecked {
  const presets: { label: string; emails: string[] }[] = [];
  const seen = new Set<string>();
  for (const b of input) {
    const label = b.label.trim();
    const emails = [...new Set(splitEmails(b.emails))];
    if (!label && !emails.length) continue;
    if (!label) return { ok: false, error: "店舗名のない行があります。店舗名を入力するか、行を削除してください。" };
    if (label.length > 60) return { ok: false, error: `店舗名「${label}」は60文字以内で入力してください。` };
    if (seen.has(normBranch(label))) return { ok: false, error: `店舗名「${label}」が重複しています。` };
    seen.add(normBranch(label));
    if (!emails.length) return { ok: false, error: `「${label}」の送信先メールアドレスを入力してください。` };
    const bad = emails.find((e) => !EMAIL_RE.test(e));
    if (bad) return { ok: false, error: `「${label}」のメールアドレスの形式が正しくありません: ${bad}` };
    presets.push({ label, emails });
  }
  return { ok: true, presets };
}

// 前の月の「同じ店舗」の請求から引き継ぐ中身(品目・金額)。スタッフ(稼働日つきの明細)は引き継がない(月が変わると稼働日が合わないため。稼働の計算は通常どおり行う)。
// ・手入力の品目(manualLines)と、その入力方法(税別/税込)・内訳書にスタッフ表を載せるか
// ・共通の項目(clientExtras。広告費など)
export type CarriedContent = {
  manualLines?: StatementSnapshot["manualLines"];
  manualTaxMode?: StatementSnapshot["manualTaxMode"];
  manualShowAttendance?: boolean;
  clientExtras: StatementExtra[];
};
export function carryFromPreviousMonth(prev: Pick<StatementSnapshot, "manualLines" | "manualTaxMode" | "manualShowAttendance" | "clientExtras"> | null): CarriedContent | null {
  if (!prev) return null;
  const manualLines = prev.manualLines?.length ? JSON.parse(JSON.stringify(prev.manualLines)) : undefined;
  const clientExtras: StatementExtra[] = JSON.parse(JSON.stringify(prev.clientExtras ?? []));
  if (!manualLines && !clientExtras.length) return null;
  return {
    ...(manualLines ? { manualLines, manualTaxMode: prev.manualTaxMode === "INCL" ? "INCL" : "EX", manualShowAttendance: prev.manualShowAttendance } : {}),
    clientExtras,
  };
}
