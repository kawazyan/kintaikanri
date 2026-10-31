// 別途報酬(リファラル報酬など)の申請で、スタッフが1行ずつ入力する内訳の検証。
// 例: 「柴田(単価38万 / 給料28万 / 会社10% 3.8万)」→ 62,000円 の行を人数分入力し、合計が申請金額になる。

export type CompensationItemInput = { label: string; amount: number; memo: string | null };

export type ParsedCompensationItems =
  | { ok: true; items: CompensationItemInput[]; total: number }
  | { ok: false; error: string };

export const MAX_COMPENSATION_ITEMS = 30;
const MAX_LABEL = 100;
const MAX_MEMO = 300;
const MAX_AMOUNT = 100_000_000;

// 全角の数字・カンマ・空白を取り除いて整数にする。整数にできなければ null。
function toAmount(raw: string): number | null {
  const half = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，¥￥円\s]/g, "");
  if (!/^\d+$/.test(half)) return null;
  return Number(half);
}

export function parseCompensationItems(labels: string[], amounts: string[], memos: string[]): ParsedCompensationItems {
  const rows = Math.max(labels.length, amounts.length, memos.length);
  const items: CompensationItemInput[] = [];
  for (let i = 0; i < rows; i++) {
    const label = (labels[i] ?? "").trim();
    const amountRaw = (amounts[i] ?? "").trim();
    const memo = (memos[i] ?? "").trim();
    // 3つとも空の行は、使っていない行として読み飛ばす。
    if (!label && !amountRaw && !memo) continue;
    const no = i + 1;
    if (!label) return { ok: false, error: `${no}行目の「対象」を入力してください。` };
    if (!amountRaw) return { ok: false, error: `${no}行目の「金額」を入力してください。` };
    const amount = toAmount(amountRaw);
    if (amount === null || amount < 1 || amount > MAX_AMOUNT) {
      return { ok: false, error: `${no}行目の「金額」は、1円以上の整数で入力してください。` };
    }
    if (label.length > MAX_LABEL) return { ok: false, error: `${no}行目の「対象」は${MAX_LABEL}文字以内にしてください。` };
    if (memo.length > MAX_MEMO) return { ok: false, error: `${no}行目の「メモ」は${MAX_MEMO}文字以内にしてください。` };
    items.push({ label, amount, memo: memo || null });
  }
  if (items.length === 0) return { ok: false, error: "内訳を1行以上入力してください。" };
  if (items.length > MAX_COMPENSATION_ITEMS) return { ok: false, error: `内訳は${MAX_COMPENSATION_ITEMS}行までです。` };
  const total = items.reduce((sum, it) => sum + it.amount, 0);
  if (total > MAX_AMOUNT) return { ok: false, error: "合計金額が大きすぎます。" };
  return { ok: true, items, total };
}
