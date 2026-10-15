import type { StatementStaff } from "@/lib/invoice-draft";

// シフトに紐付かない「手入力のスタッフ」1人ぶんの明細(純粋なロジック。DBには触れない)。
// 稼働日・金額は、あとから「修正」画面で入力・変更できる。金額0は「未入力」として扱う(承認・送付は金額が入るまで止まる)。
// manual(契約への自動登録用の情報)は付けない。シフトのない一回きりの手入力を、勝手に契約として登録しないため。
export function buildManualStaffNoShift(input: { name: string; storeName: string; serviceExTax: number; dates?: string[] }): StatementStaff {
  const store = input.storeName.trim();
  const dates = [...new Set(input.dates ?? [])].sort();
  return {
    name: input.name,
    places: store ? [store] : [],
    carriers: [],
    dates,
    ...(dates.length && store ? { dayPlaces: Object.fromEntries(dates.map((d) => [d, store])) } : {}),
    days: dates.length,
    serviceExTax: input.serviceExTax,
    serviceCalc: input.serviceExTax > 0 ? `手入力 ¥${input.serviceExTax.toLocaleString("ja-JP")}` : "金額未入力（修正画面で入力してください）",
    travel: { mode: "NONE", amountExTax: 0, amountInclTax: 0 },
  };
}

// 入力の検査。問題があれば画面に出すメッセージ(なければ null)。金額は空(0)でもよい。
export function validateManualStaffNoShift(input: { storeName: string; serviceExTax: number; dates?: string[] }, yearMonth?: string): string | null {
  for (const d of input.dates ?? []) {
    const real = /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
    if (!real || (yearMonth && !d.startsWith(`${yearMonth}-`))) return `稼働日「${d}」は、対象月${yearMonth ? `（${yearMonth}）` : ""}の正しい日付で選んでください。`;
  }
  if (!input.storeName.trim()) return "店舗名を入力してください。";
  if (!Number.isInteger(input.serviceExTax) || input.serviceExTax < 0) return "金額（税抜）は0以上の整数で入力してください（未定なら空欄）。";
  return null;
}
