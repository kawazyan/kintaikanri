import { addTax } from "@/lib/billing";

// K.J EVENT(別Supabaseプロジェクト)から、対象月に開始したイベントの広告支出実績(spent)を取得する。
// 接続先URL・キーは環境変数。未設定・取得失敗のときは例外を投げ、請求下書きを作らない(広告費の入れ忘れ防止)。
//   KJ_EVENT_SUPABASE_URL      例: https://ecuxuudjxkdbsxrvnild.supabase.co
//   KJ_EVENT_SUPABASE_SERVICE_KEY K.J EVENT の service_role キー(サーバー専用の秘密キー。RLSを越えて読めるので、ブラウザ側へは絶対に出さない)

export type EventAdLine = { label: string; store: string; period: string; amountExTax: number; amountInclTax: number; calc: string };

type Row = {
  start_date: string;
  end_date: string;
  kj_stores: { name: string } | null;
  kj_ads: { spent: number | string | null }[] | null;
};

const md = (d: string) => {
  const [, m, day] = d.split("-").map(Number);
  return `${m}月${day}日`;
};

// 切り分け用: JWT形式の鍵の「役割(role)」と「プロジェクトID(ref)」だけを取り出す(署名=秘密の部分は出さない)。
function keyInfo(key: string) {
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString("utf8"));
    return `role=${payload.role ?? "?"}・ref=${payload.ref ?? "?"}`;
  } catch {
    return "中身を読めません";
  }
}

export async function fetchEventAds(agencyId: string, yearMonth: string): Promise<EventAdLine[]> {
  const url = process.env.KJ_EVENT_SUPABASE_URL;
  const key = process.env.KJ_EVENT_SUPABASE_SERVICE_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!url || !key) {
    throw new Error("K.J EVENT の接続情報(KJ_EVENT_SUPABASE_URL / KJ_EVENT_SUPABASE_SERVICE_KEY)が未設定です。");
  }

  const [y, m] = yearMonth.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = new Date(Date.UTC(y, m, 1));
  const to = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const qs = new URLSearchParams({
    select: "start_date,end_date,kj_stores(name),kj_ads(spent)",
    agency_id: `eq.${agencyId}`,
    order: "start_date.asc",
  });
  qs.append("start_date", `gte.${from}`);
  qs.append("start_date", `lt.${to}`);

  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/kj_event_cases?${qs.toString()}`, {
    // 古い形式のキー(JWT: eyJ…)は Bearer でも送る。新形式(sb_secret_…)は apikey ヘッダーだけで送る(Bearer だと401になる)。
    headers: key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`K.J EVENT からの広告費取得に失敗しました(HTTP ${res.status})。登録されている鍵: 先頭「${key.slice(0, 3)}」・${key.length}文字・${keyInfo(key)}。`);
  const rows = (await res.json()) as Row[];

  const lines: EventAdLine[] = [];
  for (const r of rows) {
    const spent = (r.kj_ads ?? []).reduce((sum, a) => sum + Number(a.spent ?? 0), 0);
    if (spent <= 0) continue;
    const rawStore = r.kj_stores?.name ?? "店舗未定";
    const store = rawStore.endsWith("店") ? rawStore : `${rawStore}店`;
    const period = `${md(r.start_date)}～${md(r.end_date)}`;
    lines.push({
      label: `${store} ${period}`,
      store,
      period,
      amountExTax: spent,
      amountInclTax: addTax(spent).amountIncl,
      calc: "K.J EVENT 広告支出実績",
    });
  }
  return lines;
}
