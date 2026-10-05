import { normName } from "@/lib/billing-terms";
import type { StatementExtra, StatementSnapshot, StatementStaff } from "@/lib/invoice-draft";

// 請求下書きを作り直すとき、前の下書きで「手で直した項目」だけを新しい計算結果に重ねる(純粋関数。DBは触らない)。
// 手で直したかどうかは、前の下書きに残した「自動計算の元の値(baseline)」と今の値の違いで判定する。
// 直していない項目は、新しい計算結果(最新のシフト・打刻)を使う。

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const sameDates = (a: string[], b: string[]) => same([...a].sort(), [...b].sort());

export type MergeResult = { staff: StatementStaff[]; clientExtras: StatementExtra[]; notes: string[] };

export function mergeCarryOver(
  fresh: { staff: StatementStaff[]; clientExtras: StatementExtra[] },
  prev: StatementSnapshot
): MergeResult {
  const notes: string[] = [];
  const baseline = prev.baseline;
  if (!baseline) {
    notes.push("前の下書きは旧形式のため、金額・稼働日・稼働店舗・共通項目の修正は引き継げませんでした（追加したスタッフ、宛名・件名・備考は引き継ぎ済み）。");
    return { staff: fresh.staff, clientExtras: fresh.clientExtras, notes };
  }

  const staff = fresh.staff.map((f) => {
    const p = prev.staff.find((x) => normName(x.name) === normName(f.name));
    const b = baseline.staff.find((x) => normName(x.name) === normName(f.name));
    if (!p || !b) return f;
    const out: StatementStaff = { ...f };
    const carried: string[] = [];

    if (!sameDates(p.dates, b.dates)) {
      out.dates = [...p.dates].sort();
      out.days = out.dates.length;
      out.dayPlaces = { ...(f.dayPlaces ?? {}), ...(p.dayPlaces ?? {}) };
      carried.push("稼働日");
    }
    // 稼働日ごとの店舗: 手で直した日だけ上書きする。
    const placeEdits = Object.entries(p.dayPlaces ?? {}).filter(([d, v]) => (b.dayPlaces?.[d] ?? "") !== v && out.dates.includes(d));
    if (placeEdits.length) {
      out.dayPlaces = { ...(out.dayPlaces ?? {}), ...Object.fromEntries(placeEdits) };
      carried.push("稼働店舗");
    }
    if (carried.length) {
      const dp = out.dayPlaces ?? {};
      out.dayPlaces = Object.fromEntries(out.dates.flatMap((d) => (dp[d] ? [[d, dp[d]]] : [])));
      const places = [...new Set(out.dates.map((d) => out.dayPlaces?.[d]).filter((x): x is string => !!x))];
      if (places.length) out.places = places;
    }
    if (p.serviceExTax !== b.serviceExTax || p.serviceCalc !== b.serviceCalc) {
      out.serviceExTax = p.serviceExTax;
      out.serviceCalc = p.serviceCalc;
      carried.push("業務委託費");
    }
    if (!same(p.travel, b.travel)) {
      out.travel = p.travel;
      carried.push("交通費");
    }
    if (carried.length) notes.push(`${f.name}さん: 前の下書きで直した「${carried.join("・")}」を引き継ぎました。`);
    return out;
  });

  for (const p of prev.staff) {
    if (!staff.some((x) => normName(x.name) === normName(p.name))) {
      notes.push(`前の下書きにいた${p.name}さんは、今回の計算には含まれませんでした（稼働実績・契約を確認してください）。`);
    }
  }

  let clientExtras = fresh.clientExtras;
  if (!same(prev.clientExtras ?? [], baseline.clientExtras ?? [])) {
    clientExtras = prev.clientExtras ?? [];
    notes.push("共通の項目（新幹線代・広告費など）は、前の下書きで直した内容を引き継ぎました。");
  }
  return { staff, clientExtras, notes };
}
