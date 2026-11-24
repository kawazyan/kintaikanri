// 取引先ごとの請求の取り決め(Client.billingTerms)。
export type TravelByStore = { match: string; perDayExTax: number; detail: string };

// シフトからの請求ルール。稼働依頼がなくても、スタッフ(・店舗)のシフトから請求を作れる。
export type ShiftBillingRule = {
  staffName: string; // スタッフ名(空白は無視して一致)
  storeMatch?: string[]; // 指定すると、店舗名にどれかを含むシフトだけが対象
  storeName?: string; // 店舗名。スタッフがシフトを登録するとき、店舗名にこれが自動で入る(storeMatch のどれかを含む名前にすること)
  storeKind?: "SHOP" | "RETAIL"; // SHOP=キャリアショップ(シフトの店舗名の先頭に「キャリア名＋ショップ」を付ける。例: 西多賀 → auショップ西多賀) / RETAIL=家電量販店(そのまま)。storeName があるときだけ有効
  dates?: string[]; // 指定すると、この稼働日(YYYY-MM-DD)のシフトだけが対象
  fromMonth?: string; // 適用開始月(YYYY-MM)
  toMonth?: string; // 適用終了月(YYYY-MM)
  contract: "DAILY" | "MONTHLY"; // DAILY=日額×稼働日 / MONTHLY=月額固定(稼働が1日でもあれば)
  rateExTax: number; // 日額 or 月額(税抜)
  absenceDeduction?: "YES" | "NO"; // 月額のとき、欠勤で減算するか(YES=月額÷予定日数×稼働日数。省略はNO=固定)
  plannedDays?: number; // 欠勤減算ありのときの予定日数
  flatTravelExTax?: number; // 月額一律の交通費(税抜)
  travelByStore?: TravelByStore[]; // 店舗ごとの1日あたり交通費(税抜・往復)。なければ取引先共通のものを使う
  note?: string; // 計算方法に足す一言(例: 16稼働)
  // 月ごとに交通費へ加算する固定額(税抜)。例: 新幹線代。稼働が1日でもある月だけ、このスタッフの交通費に足す。
  extraTravel?: { label: string; amountExTax: number; calc: string }[];
};

export type BillingTerms = {
  travelByStore?: TravelByStore[];
  // 稼働が1日でもあれば毎月加算する固定項目(税抜)。例: 新幹線代。
  monthlyExtras?: { label: string; amountExTax: number; calc: string }[];
  shiftBilling?: ShiftBillingRule[];
  // 請求内訳書のキャリア欄に固定で出す表記(例: ["au", "UQ"])。指定がなければシフトのキャリアから拾う。
  carriers?: string[];
  // true なら、請求内訳書の店名(稼働場所・広告のイベント主催店舗)の末尾に「店」を付けて表示する。
  shopSuffix?: boolean;
  // true なら、請求書の品目を「業務委託費一式」ではなく「稼働費用（スタッフ名）」「交通費相当額」などに分けて表示する。
  splitInvoiceLines?: boolean;
  // 請求内訳書を店舗ごとに分ける(請求書は1枚)。スタッフの稼働を店舗ごとに分け、広告費と同じ店舗(表記揺れは照合)でまとめる。
  statementByStore?: boolean;
  // 請求内訳書での「業務委託費」の呼び方(例: 稼働費)。請求書の品目は変えない。
  statementServiceLabel?: string;
  // 請求内訳書の「〇年〇月請求分」の「請求分」の部分(省略=請求分。送付済みの古い請求は「稼働分」を保存してある)。
  statementMonthSuffix?: string;
  // 請求メールのPDFの付け方。COMBINED=請求書→請求内訳書の順に1つのPDF / 省略(SEPARATE)=2つのPDFをバラで添付。
  pdfBundle?: "COMBINED" | "SEPARATE";
  // この取引先あての請求書メールだけ、確認用にBCC(先方には見えない)で自動追加する自社アドレス。
  confirmBcc?: string[];
  // 店舗ごとなど、請求書の送信先として登録しておく宛先(請求書・見積書の画面で選ぶと送信先の枠に入る)。管理者のCCは自動なので入れない。
  // area を指定すると、そのエリアの担当者(recipientAreas)が自動で宛先に入る(emails にはその店舗だけの宛先を入れる)。
  recipientPresets?: { label: string; emails: string[]; area?: string }[];
  // エリアごとの担当者(例: コスモネットの青森秋田・岩手・宮城・福島)。担当者を変えると、そのエリアの全店舗の宛先に反映される。
  recipientAreas?: RecipientArea[];
};

// 宛先の担当者。name は確認画面に出す名前(例: 千坂TSL・石沢 様)。greet=true の人は、メール本文の宛名の下に「〇〇 様」と書く。
export type RecipientPerson = { name: string; email: string; greet?: boolean };
export type RecipientArea = { key: string; label: string; people: RecipientPerson[] };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// メール形式のものだけを、重複(大文字小文字は区別しない)を除いて取り出す。
function validEmails(raw: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    const e = typeof x === "string" ? x.trim() : "";
    if (!EMAIL_PATTERN.test(e) || seen.has(e.toLowerCase())) continue;
    seen.add(e.toLowerCase());
    out.push(e);
  }
  return out;
}

// 店舗名の比較用(全角半角・空白・大文字小文字の違いは同じ扱い)。
const normLabel = (s: string) => s.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
// 見積書は店舗名を自由に入力できるため、「SB奥州水沢」と「SB奥州水沢店」「ソフトバンク奥州水沢店」を同じ店として照合する(語尾の「店」・SB/ソフトバンクの違いを無視)。
const storeKey = (s: string) => normLabel(s).replace(/ソフトバンク|softbank/g, "sb").replace(/店$/, "");

// 登録済みのエリア(担当者つき)。メール形式でない人は除く。
export function recipientAreasOf(terms: BillingTerms | null | undefined): RecipientArea[] {
  const out: RecipientArea[] = [];
  for (const a of terms?.recipientAreas ?? []) {
    const key = typeof a?.key === "string" ? a.key.trim() : "";
    const label = typeof a?.label === "string" ? a.label.trim() : "";
    if (!key || !label) continue;
    const people: RecipientPerson[] = [];
    const seen = new Set<string>();
    for (const p of Array.isArray(a.people) ? a.people : []) {
      const email = typeof p?.email === "string" ? p.email.trim() : "";
      const name = typeof p?.name === "string" ? p.name.trim() : "";
      if (!EMAIL_PATTERN.test(email) || seen.has(email.toLowerCase())) continue;
      seen.add(email.toLowerCase());
      people.push({ name, email, ...(p.greet ? { greet: true } : {}) });
    }
    out.push({ key, label, people });
  }
  return out;
}

// 登録済みの宛先(recipientPresets)そのまま(エリアの担当者は足さない)。店舗ごとの宛先の編集画面で使う。
export function recipientPresetsRawOf(terms: BillingTerms | null | undefined): { label: string; emails: string[]; area?: string }[] {
  const areaKeys = new Set(recipientAreasOf(terms).map((a) => a.key));
  const out: { label: string; emails: string[]; area?: string }[] = [];
  for (const p of terms?.recipientPresets ?? []) {
    const label = typeof p?.label === "string" ? p.label.trim() : "";
    const emails = validEmails(Array.isArray(p?.emails) ? p.emails : []);
    const area = typeof p?.area === "string" && areaKeys.has(p.area) ? p.area : undefined;
    if (label && (emails.length || area)) out.push({ label, emails, ...(area ? { area } : {}) });
  }
  return out;
}

// 登録済みの宛先(recipientPresets)から、名前があり、メール形式のアドレスが1件以上あるものだけを取り出す(重複は除く)。
// エリアを指定した店舗は、そのエリアの担当者のアドレスを先に並べ、その店舗だけの宛先を続ける。
export function recipientPresetsOf(terms: BillingTerms | null | undefined): { label: string; emails: string[]; area?: string }[] {
  const areas = recipientAreasOf(terms);
  const out: { label: string; emails: string[]; area?: string }[] = [];
  for (const p of recipientPresetsRawOf(terms)) {
    const people = p.area ? (areas.find((a) => a.key === p.area)?.people ?? []) : [];
    const emails = validEmails([...people.map((x) => x.email), ...p.emails]);
    if (emails.length) out.push({ label: p.label, emails, ...(p.area ? { area: p.area } : {}) });
  }
  return out;
}

// メールアドレス → 担当者の名前(エリアに登録した人だけ)。確認画面で宛先の名前を出すのに使う。
export function recipientDetailsOf(terms: BillingTerms | null | undefined, emails: string[]): { email: string; name: string | null }[] {
  const names = new Map<string, string>();
  for (const a of recipientAreasOf(terms)) for (const p of a.people) if (p.name && !names.has(p.email.toLowerCase())) names.set(p.email.toLowerCase(), p.name);
  return emails.map((email) => ({ email, name: names.get(email.toLowerCase()) ?? null }));
}

// 店舗(請求先)のエリアで、メール本文の宛名の下に書く担当者の名前(例: 千坂TSL)。店舗が見つからない・エリアなしは空。
export function greetNamesFor(terms: BillingTerms | null | undefined, branch: string | null | undefined): string[] {
  if (!branch?.trim()) return [];
  const preset = recipientPresetsRawOf(terms).find((p) => storeKey(p.label) === storeKey(branch));
  if (!preset?.area) return [];
  const area = recipientAreasOf(terms).find((a) => a.key === preset.area);
  return (area?.people ?? []).filter((p) => p.greet && p.name).map((p) => p.name);
}

// 確認用BCCの宛先: 設定のアドレスから、メールの形式でないもの・すでに宛先(to/cc)にあるもの・重複を除く(大文字小文字は区別しない)。
export function confirmBccFor(terms: BillingTerms | null | undefined, to: string[], cc: string[]) {
  const used = new Set([...to, ...cc].map((x) => x.trim().toLowerCase()));
  const out: string[] = [];
  for (const raw of terms?.confirmBcc ?? []) {
    const e = raw.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || used.has(e.toLowerCase())) continue;
    used.add(e.toLowerCase());
    out.push(e);
  }
  return out;
}

export const normName = (s: string) => s.replace(/[\s　]/g, "");

export function activeShiftRules(terms: BillingTerms | null | undefined, yearMonth: string) {
  return (terms?.shiftBilling ?? []).filter(
    (r) => (!r.fromMonth || yearMonth >= r.fromMonth) && (!r.toMonth || yearMonth <= r.toMonth)
  );
}

export function ruleMatchesShift(rule: ShiftBillingRule, staffName: string, storeName: string, dateKey: string) {
  if (normName(rule.staffName) !== normName(staffName)) return false;
  if (rule.dates?.length && !rule.dates.includes(dateKey)) return false;
  return !rule.storeMatch?.length || rule.storeMatch.some((m) => storeName.includes(m));
}

// 掛け持ちのスタッフ向け: 追加するスタッフ・店舗について、他の取引先の契約との関係を調べる。
// others=他の取引先にも契約があるスタッフ(警告用) / conflict=同じ店舗で重なる他社契約(店舗指定なし、または店舗名が重なる。日付指定つきの契約は店舗が重なるときだけ)。
export function otherClientContracts(
  clients: { id: string; name: string; billingTerms: unknown }[],
  clientId: string,
  yearMonth: string,
  staffName: string,
  storeName: string
): { others: string[]; conflict: string | null } {
  const others: string[] = [];
  let conflict: string | null = null;
  for (const c of clients) {
    if (c.id === clientId) continue;
    const rules = activeShiftRules(c.billingTerms as BillingTerms | null, yearMonth).filter((r) => normName(r.staffName) === normName(staffName));
    if (!rules.length) continue;
    others.push(c.name);
    const overlap = rules.some((r) =>
      r.storeMatch?.length ? r.storeMatch.some((x) => storeName.includes(x) || x.includes(storeName)) : !r.dates?.length
    );
    if (overlap && !conflict) conflict = c.name;
  }
  return { others, conflict };
}
