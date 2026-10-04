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
