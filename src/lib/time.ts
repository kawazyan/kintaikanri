const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// Returns the [start, end) UTC instants corresponding to the JST calendar
// day that `at` (an absolute instant) falls on. Used because shifts are
// scheduled against Japan-local calendar days regardless of server TZ.
export function jstDayRange(at: Date = new Date()): { start: Date; end: Date } {
  const jstMs = at.getTime() + JST_OFFSET_MS;
  const jstDate = new Date(jstMs);
  const y = jstDate.getUTCFullYear();
  const m = jstDate.getUTCMonth();
  const d = jstDate.getUTCDate();
  const startJstMs = Date.UTC(y, m, d, 0, 0, 0, 0);
  const start = new Date(startJstMs - JST_OFFSET_MS);
  const end = new Date(startJstMs + 24 * 60 * 60 * 1000 - JST_OFFSET_MS);
  return { start, end };
}

export function toJstInputValue(date: Date): string {
  const jstMs = date.getTime() + JST_OFFSET_MS;
  const jst = new Date(jstMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(
    jst.getUTCDate()
  )}T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}

// Interprets a "YYYY-MM-DDTHH:mm" datetime-local value as JST wall-clock
// time and returns the corresponding absolute instant.
export function fromJstInputValue(value: string): Date {
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0) - JST_OFFSET_MS;
  return new Date(utcMs);
}

// Combines a "YYYY-MM-DD" date and "HH:mm" time (both JST wall-clock) into
// the corresponding absolute instant.
export function combineJstDateAndTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0) - JST_OFFSET_MS;
  return new Date(utcMs);
}

export function toJstDateValue(date: Date): string {
  const jstMs = date.getTime() + JST_OFFSET_MS;
  const jst = new Date(jstMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`;
}

export function toJstTimeValue(date: Date): string {
  const jstMs = date.getTime() + JST_OFFSET_MS;
  const jst = new Date(jstMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}

export function formatJstDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

export function daysInJstMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function makeJstDateOnly(year: number, month1: number, day: number): Date {
  const utcMs = Date.UTC(year, month1 - 1, day, 0, 0, 0, 0) - JST_OFFSET_MS;
  return new Date(utcMs);
}

export function formatJst(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function currentJstYearMonth(at: Date = new Date()): string {
  const jst = new Date(at.getTime() + JST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}`;
}

export function yearMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${y}年${m}月`;
}

// Generates selectable "YYYY-MM" options around the current JST month.
export function listMonthOptions(
  pastCount: number,
  futureCount: number,
  at: Date = new Date()
): { value: string; label: string }[] {
  const jst = new Date(at.getTime() + JST_OFFSET_MS);
  const baseYear = jst.getUTCFullYear();
  const baseMonth = jst.getUTCMonth(); // 0-indexed

  const options: { value: string; label: string }[] = [];
  for (let offset = -pastCount; offset <= futureCount; offset++) {
    const d = new Date(Date.UTC(baseYear, baseMonth + offset, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const value = `${y}-${String(m).padStart(2, "0")}`;
    options.push({ value, label: `${y}年${m}月` });
  }
  return options;
}

// [start, end) UTC instants spanning the given JST calendar month.
export function jstMonthRange(yearMonth: string): { start: Date; end: Date } {
  const [y, m] = yearMonth.split("-").map(Number);
  const startJstMs = Date.UTC(y, m - 1, 1, 0, 0, 0, 0);
  const endJstMs = Date.UTC(y, m, 1, 0, 0, 0, 0);
  return {
    start: new Date(startJstMs - JST_OFFSET_MS),
    end: new Date(endJstMs - JST_OFFSET_MS),
  };
}

export type MonthDay = {
  dateKey: string; // "YYYY-MM-DD"
  day: number;
  weekday: number; // 0 (Sun) - 6 (Sat)
  weekdayLabel: string;
  isWeekend: boolean;
};

export function listDaysInJstYearMonth(yearMonth: string): MonthDay[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");

  const days: MonthDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    days.push({
      dateKey: `${y}-${pad(m)}-${pad(d)}`,
      day: d,
      weekday,
      weekdayLabel: WEEKDAY_LABELS[weekday],
      isWeekend: weekday === 0 || weekday === 6,
    });
  }
  return days;
}

// Half-hour increments covering a full day, for start/end time dropdowns.
export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const min = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${min}`;
});
