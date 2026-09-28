import { toJstTimeValue } from "./time";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function isUpcomingShift(now: Date, startTime: Date): boolean {
  const remaining = startTime.getTime() - now.getTime();
  return remaining > 0 && remaining <= FIVE_MINUTES_MS;
}

export function isDailySummaryWindow(now: Date): boolean {
  const time = toJstTimeValue(now);
  return time >= "09:00" && time < "10:00";
}
