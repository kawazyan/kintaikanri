// 日額×日数の契約(DAILY)で、請求の修正画面で稼働日を足したり減らしたりしたときの、業務委託費(税抜)と計算方法の文を求める。
// 純粋関数(DBは触らない)。月額の契約(固定・欠勤控除あり)は対象外で、null を返す。

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

// 下書き作成時に作る計算方法の文: 「日額 ¥20,000 × 3日」＋(あれば)末尾の一言(例:「（16稼働）」)。
const DAILY_CALC = /^日額\s*¥([\d,]+)\s*×\s*(\d+)日([\s\S]*)$/;

// 承認済みの「当日単価変更」を含む請求は、日によって単価が違うので、日数だけでは金額を決められない。
const HAS_DAY_OVERRIDE = "当日単価変更";

type DailyStaff = { dailyRateExTax?: number; serviceCalc: string };

// 日額(税抜)と、計算方法の末尾の一言を取り出す。日額×日数の契約でなければ null。
// 新しく作った下書きは dailyRateExTax を持つ。以前に作った下書きは持たないので、計算方法の文から日額を読み取る。
export function dailyRateOf(s: DailyStaff): { rate: number; tail: string } | null {
  if (s.serviceCalc.includes(HAS_DAY_OVERRIDE)) return null;
  const m = DAILY_CALC.exec(s.serviceCalc);
  const tail = m ? m[3] : "";
  if (s.dailyRateExTax !== undefined && s.dailyRateExTax !== null) {
    return Number.isInteger(s.dailyRateExTax) && s.dailyRateExTax > 0 ? { rate: s.dailyRateExTax, tail } : null;
  }
  if (!m) return null;
  const rate = Number(m[1].replace(/,/g, ""));
  return Number.isInteger(rate) && rate > 0 ? { rate, tail } : null;
}

// 稼働日数が dayCount 日になったときの、業務委託費(税抜)と計算方法の文。日額×日数の契約でなければ null。
export function recalcDailyService(s: DailyStaff, dayCount: number): { serviceExTax: number; serviceCalc: string } | null {
  const d = dailyRateOf(s);
  if (!d) return null;
  const days = Math.max(0, Math.trunc(dayCount));
  return { serviceExTax: d.rate * days, serviceCalc: `日額 ${yen(d.rate)} × ${days}日${d.tail}` };
}

// 稼働日を日付の昇順に並べ、空欄と同じ日の重複を除く。
export function sortDates(dates: string[]): string[] {
  return [...new Set(dates.map((d) => d.trim()).filter(Boolean))].sort();
}

// 修正画面で表示する並び: 入力済みの日付を昇順にし、空欄(入力途中)は末尾に残す。重複も消さない(消すと入力中の欄が勝手に消えるため。保存時に sortDates で整える)。
export function orderDatesForEdit(dates: string[]): string[] {
  return [...dates.filter((d) => d).sort(), ...dates.filter((d) => !d)];
}

// 稼働日数: 空欄と同じ日の重複を除いた日数(保存後の日数と同じ)。
export function countDays(dates: string[]): number {
  return sortDates(dates).length;
}

// 「稼働日を追加」で入れる日付の初期値: その月の1日から数えて、まだ使っていない最初の日。月内に空きがなければ月末日。
export function nextFreeDate(yearMonth: string, used: string[]): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let day = 1; day <= last; day++) {
    const d = `${yearMonth}-${String(day).padStart(2, "0")}`;
    if (!used.includes(d)) return d;
  }
  return `${yearMonth}-${String(last).padStart(2, "0")}`;
}
