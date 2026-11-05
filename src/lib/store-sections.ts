import type { StatementExtra, StatementStaff } from "@/lib/invoice-draft";

// 店舗別の請求内訳書(取引先の設定 statementByStore)のための、店舗名の照合と振り分け。
// 勤怠の店舗名(例: au東仙台フォレオ)と K.J EVENT の店舗名(例: auフォレオ東仙台店)は表記が揺れるので、
// 共通の飾り(au・ショップ・末尾の「店」・「仙台」・空白)を除いてから、文字の並び(2文字ずつ)の重なりで同じ店舗かを判定する。

export function storeKey(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/auショップ|ショップ|^au|店$/g, "")
    .replace(/仙台/g, "");
}

function bigrams(s: string): string[] {
  if (s.length < 2) return s ? [s] : [];
  return Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2));
}

// 0〜1。1 = 同じ店舗とみなせる。
export function storeSimilarity(a: string, b: string): number {
  const ka = storeKey(a);
  const kb = storeKey(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  if (ka.includes(kb) || kb.includes(ka)) return 0.9;
  const A = bigrams(ka);
  const B = [...bigrams(kb)];
  let hit = 0;
  for (const g of A) {
    const i = B.indexOf(g);
    if (i >= 0) {
      hit++;
      B.splice(i, 1);
    }
  }
  return (2 * hit) / (A.length + bigrams(kb).length);
}

export const STORE_MATCH_THRESHOLD = 0.5;

// 名前の一覧から、同じ店舗とみなせる一番近い名前を返す(なければ null)。
export function matchStore(name: string, candidates: string[]): string | null {
  let best: string | null = null;
  let score = 0;
  for (const c of candidates) {
    const s = storeSimilarity(name, c);
    if (s > score) {
      score = s;
      best = c;
    }
  }
  return score >= STORE_MATCH_THRESHOLD ? best : null;
}

// 金額を日数で店舗に分ける。1日あたりは切り捨て、余り(端数)は日数が一番多い店舗(同じ日数なら先に稼働した店舗)に足す。
export function prorateByDays(total: number, groups: { key: string; days: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  const days = groups.reduce((a, g) => a + g.days, 0);
  if (!days) return out;
  const perDay = Math.floor(total / days);
  for (const g of groups) out.set(g.key, perDay * g.days);
  const rest = total - perDay * days;
  if (rest) {
    const top = groups.reduce((b, g) => (g.days > b.days ? g : b), groups[0]);
    out.set(top.key, (out.get(top.key) ?? 0) + rest);
  }
  return out;
}

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

// スタッフの行を、稼働した店舗ごとの行に分け、広告費の行と同じ店舗名(区分)でまとめる。
// 店舗名は、K.J EVENT(広告費)の表記があればそちらにそろえる。業務委託費は日額の契約なら日額×日数、月額なら日数で按分する。
// 交通費は、店舗ごとの実費が分からないため日数で按分し、確認を促す注意を返す。
export function splitByStore(staff: StatementStaff[], extras: StatementExtra[]): { staff: StatementStaff[]; extras: StatementExtra[]; warnings: string[] } {
  const warnings: string[] = [];
  const adStores = [...new Set(extras.filter((e) => e.store).map((e) => e.store!))];
  const sectionOf = (place: string) => matchStore(place, adStores) ?? place;
  const out: StatementStaff[] = [];
  for (const s of staff) {
    const groups = new Map<string, string[]>();
    for (const d of s.dates) {
      const place = s.dayPlaces?.[d] ?? s.places[0] ?? "店舗未定";
      const sec = sectionOf(place);
      groups.set(sec, [...(groups.get(sec) ?? []), d]);
    }
    if (groups.size === 0) {
      out.push({ ...s, section: s.places[0] ? sectionOf(s.places[0]) : undefined });
      continue;
    }
    const list = [...groups].map(([key, ds]) => ({ key, days: ds.length, dates: ds }));
    const total = s.dates.length;
    const svc = s.dailyRateExTax ? new Map(list.map((g) => [g.key, s.dailyRateExTax! * g.days])) : prorateByDays(s.serviceExTax ?? 0, list);
    const trv = prorateByDays(s.travel.amountExTax, list);
    const trvIncl = prorateByDays(s.travel.amountInclTax, list);
    const perDay = total ? Math.floor((s.serviceExTax ?? 0) / total) : 0;
    if (list.length > 1 && s.travel.amountExTax > 0) warnings.push(`${s.name}さんの交通費は、店舗ごとに稼働日数で按分しました。実費が店舗ごとに違う場合は、修正画面で直してください。`);
    for (const g of list) {
      const service = svc.get(g.key) ?? 0;
      const travelEx = trv.get(g.key) ?? 0;
      const travelIncl = trvIncl.get(g.key) ?? 0;
      const adj = s.dailyRateExTax ? 0 : service - perDay * g.days;
      out.push({
        ...s,
        section: g.key,
        places: [g.key],
        dates: g.dates,
        dayPlaces: Object.fromEntries(g.dates.map((d) => [d, g.key])),
        days: g.days,
        serviceExTax: service,
        serviceCalc:
          list.length === 1
            ? s.serviceCalc
            : s.dailyRateExTax
              ? `日額 ${yen(s.dailyRateExTax)} × ${g.days}日`
              : `${s.serviceCalc.replace(/（.*）$/, "")} ÷ 稼働${total}日 = 1日 ${yen(perDay)} × ${g.days}日${adj ? ` ＋ 端数調整 ${yen(adj)}` : ""}`,
        travel:
          travelEx || travelIncl
            ? { mode: s.travel.mode, amountExTax: travelEx, amountInclTax: travelIncl, ...(list.length === 1 ? { calc: s.travel.calc, lines: s.travel.lines } : { calc: `${yen(s.travel.amountExTax)} を稼働日数で按分（${g.days}日／${total}日）` }) }
            : { mode: "NONE", amountExTax: 0, amountInclTax: 0 },
        extras: list.length === 1 || g === list[0] ? s.extras : [],
      });
    }
  }
  const outExtras = extras.map((e) => ({ ...e, section: e.store ? (matchStore(e.store, out.map((x) => x.section!).filter(Boolean)) ?? e.store) : e.section }));
  // 広告費の店舗名にそろえたので、スタッフ側と同じ名前になる。広告費だけの店舗も、その店舗名の区分になる。
  return { staff: out, extras: outExtras, warnings };
}
