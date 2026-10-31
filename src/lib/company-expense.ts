// 会社の経費(家賃・カード・駐車場代・税理士顧問料など)の入力検証。管理者専用ページ(/admin/company-expenses)で使う。

export const COMPANY_EXPENSE_CATEGORIES = ["家賃・事務所代", "カード払い", "車両費", "税理士顧問料", "駐車場代", "その他"] as const;
export type CompanyExpenseCategory = (typeof COMPANY_EXPENSE_CATEGORIES)[number];

export type CompanyExpenseInput = {
  expenseDate: string; // YYYY-MM-DD(JSTの日付)
  yearMonth: string; // YYYY-MM
  category: CompanyExpenseCategory;
  item: string;
  amount: number;
  recurring: boolean;
  memo: string | null;
};

export type ParsedCompanyExpense = { ok: true; value: CompanyExpenseInput } | { ok: false; error: string };

const MAX_AMOUNT = 1_000_000_000;

// 実在する日付(2026-02-30 のような存在しない日はNG)かどうか。
export function isRealDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isYearMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function parseCompanyExpense(raw: { expenseDate: string; category: string; item: string; amount: string; recurring: boolean; memo: string }): ParsedCompanyExpense {
  const expenseDate = raw.expenseDate.trim();
  if (!isRealDate(expenseDate)) return { ok: false, error: "日付を正しく入力してください。" };
  const category = COMPANY_EXPENSE_CATEGORIES.find((c) => c === raw.category);
  if (!category) return { ok: false, error: "区分を選んでください。" };
  const item = raw.item.trim();
  if (!item) return { ok: false, error: "項目(支払先など)を入力してください。" };
  if (item.length > 100) return { ok: false, error: "項目は100文字以内にしてください。" };
  const half = raw.amount
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，¥￥円\s]/g, "");
  if (!/^\d+$/.test(half)) return { ok: false, error: "金額は、1円以上の整数で入力してください。" };
  const amount = Number(half);
  if (amount < 1 || amount > MAX_AMOUNT) return { ok: false, error: "金額は、1円以上の整数で入力してください。" };
  const memo = raw.memo.trim();
  if (memo.length > 300) return { ok: false, error: "メモは300文字以内にしてください。" };
  return { ok: true, value: { expenseDate, yearMonth: expenseDate.slice(0, 7), category, item, amount, recurring: raw.recurring, memo: memo || null } };
}
