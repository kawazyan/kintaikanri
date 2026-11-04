import type { StatementStaff } from "@/lib/invoice-draft";
import { normName } from "@/lib/billing-terms";

// シフトに紐付かない「手入力のスタッフ」1人ぶんの明細(純粋なロジック。DBには触れない)。
// 稼働日・金額は、あとから「修正」画面で入力・変更できる。金額0は「未入力」として扱う(承認・送付は金額が入るまで止まる)。
// manual(契約への自動登録用の情報)は付けない。シフトのない一回きりの手入力を、勝手に契約として登録しないため。
// external=true は、勤怠に登録していない人(パートナー会社のスタッフなど)。carrier は請求内訳書の「稼働キャリア」に載せる(任意)。
export function buildManualStaffNoShift(input: { name: string; storeName: string; serviceExTax: number; dates?: string[]; external?: boolean; carrier?: string }): StatementStaff {
  const store = input.storeName.trim();
  const dates = [...new Set(input.dates ?? [])].sort();
  return {
    name: input.name,
    places: store ? [store] : [],
    carriers: input.carrier?.trim() ? [input.carrier.trim()] : [],
    dates,
    ...(dates.length && store ? { dayPlaces: Object.fromEntries(dates.map((d) => [d, store])) } : {}),
    days: dates.length,
    serviceExTax: input.serviceExTax,
    serviceCalc: input.serviceExTax > 0 ? `手入力 ¥${input.serviceExTax.toLocaleString("ja-JP")}` : "金額未入力（修正画面で入力してください）",
    travel: { mode: "NONE", amountExTax: 0, amountInclTax: 0 },
    ...(input.external ? { external: true } : {}),
  };
}

// 勤怠に登録していない人の名前の検査。問題があれば画面に出すメッセージ(なければ null)。
// ・同じ請求にすでにいる人、勤怠に登録済みのスタッフと同じ名前は追加しない(登録済みの人は、スタッフを選んで追加する)。
export function validateExternalStaffName(name: string, namesInInvoice: string[], registeredNames: string[]): string | null {
  const n = normName(name.normalize("NFKC"));
  if (!n) return "スタッフ名を入力してください。";
  if (n.length > 50) return "スタッフ名は50文字以内で入力してください。";
  const same = (x: string) => normName(x.normalize("NFKC")) === n;
  if (namesInInvoice.some(same)) return `${name.trim()}さんはすでにこの請求に入っています。`;
  if (registeredNames.some(same)) return `${name.trim()}さんは勤怠に登録済みのスタッフです。「勤怠に登録済みのスタッフ」を選んで追加してください。`;
  return null;
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
