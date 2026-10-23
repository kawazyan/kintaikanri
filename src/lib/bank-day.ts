import holidayJp from "@holiday-jp/holiday_jp";
import { toJstDateValue } from "@/lib/time";

// 銀行の営業日の判定(振込日の前倒し用)。
// 休業日 = 土日 / 国民の祝日(内閣府の祝日データ。@holiday-jp/holiday_jp) / 12/29〜1/3(銀行の年末年始休業)。
// 祝日データはライブラリに入っている範囲のみ。年が進んだらライブラリを更新すること(npm update @holiday-jp/holiday_jp)。

const DAY_MS = 24 * 60 * 60 * 1000;

// dateKey = "YYYY-MM-DD"(JSTの暦日)
export function isBankHoliday(dateKey: string): boolean {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (weekday === 0 || weekday === 6) return true;
  if ((m === 12 && d >= 29) || (m === 1 && d <= 3)) return true;
  return holidayJp.isHoliday(dateKey);
}

// 支払日が銀行休業日なら、その直前の営業日に前倒しする。営業日ならそのまま返す。
// date は JST の暦日の 0:00(makeJstDateOnly の戻り値)。戻り値も同じ形式。
export function toPreviousBankBusinessDay(date: Date): Date {
  let d = date;
  for (let i = 0; i < 15; i++) {
    if (!isBankHoliday(toJstDateValue(d))) return d;
    d = new Date(d.getTime() - DAY_MS);
  }
  return d;
}
