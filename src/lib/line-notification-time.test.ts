import assert from "node:assert/strict";
import test from "node:test";
import { isDailySummaryWindow, isUpcomingShift } from "./line-notification-time";

test("出勤予定の5分前から開始直前までを通知対象にする", () => {
  const start = new Date("2026-09-28T00:00:00.000Z"); // 09:00 JST
  assert.equal(isUpcomingShift(new Date("2026-09-27T23:54:59.999Z"), start), false);
  assert.equal(isUpcomingShift(new Date("2026-09-27T23:55:00.000Z"), start), true);
  assert.equal(isUpcomingShift(new Date("2026-09-27T23:59:59.999Z"), start), true);
  assert.equal(isUpcomingShift(start, start), false);
});

test("毎朝の一覧は日本時間9時台だけ送信対象にする", () => {
  assert.equal(isDailySummaryWindow(new Date("2026-09-27T23:59:59.000Z")), false);
  assert.equal(isDailySummaryWindow(new Date("2026-09-28T00:00:00.000Z")), true);
  assert.equal(isDailySummaryWindow(new Date("2026-09-28T00:59:59.000Z")), true);
  assert.equal(isDailySummaryWindow(new Date("2026-09-28T01:00:00.000Z")), false);
});
