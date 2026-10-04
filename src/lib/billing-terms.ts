// 取引先ごとの請求の取り決め(Client.billingTerms)。
export type TravelByStore = { match: string; perDayExTax: number; detail: string };

// シフトからの請求ルール。稼働依頼がなくても、スタッフ(・店舗)のシフトから請求を作れる。
export type ShiftBillingRule = {
  staffName: string; // スタッフ名(空白は無視して一致)
  storeMatch?: string[]; // 指定すると、店舗名にどれかを含むシフトだけが対象
  dates?: string[]; // 指定すると、この稼働日(YYYY-MM-DD)のシフトだけが対象
  fromMonth?: string; // 適用開始月(YYYY-MM)
  toMonth?: string; // 適用終了月(YYYY-MM)
  contract: "DAILY" | "MONTHLY"; // DAILY=日額×稼働日 / MONTHLY=月額固定(稼働が1日でもあれば)
  rateExTax: number; // 日額 or 月額(税抜)
  flatTravelExTax?: number; // 月額一律の交通費(税抜)
  travelByStore?: TravelByStore[]; // 店舗ごとの1日あたり交通費(税抜・往復)。なければ取引先共通のものを使う
  note?: string; // 計算方法に足す一言(例: 16稼働)
};

export type BillingTerms = {
  travelByStore?: TravelByStore[];
  // 稼働が1日でもあれば毎月加算する固定項目(税抜)。例: 新幹線代。
  monthlyExtras?: { label: string; amountExTax: number; calc: string }[];
  shiftBilling?: ShiftBillingRule[];
};

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
