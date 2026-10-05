import { prisma } from "@/lib/prisma";
import { sendLinePush } from "@/lib/line";
import { formatJstDate, jstDayRange, toJstDateValue, toJstTimeValue } from "@/lib/time";
import { isDailySummaryWindow, isUpcomingShift } from "@/lib/line-notification-time";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// 出勤5分前アラートに添付する、スタッフ用の打刻ページURL。
// (未ログインの場合は自動でログイン画面に移動し、ログイン後に打刻画面が開く)
const STAFF_CLOCK_URL = "https://kintaikanri-2.vercel.app/clock";

function isUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function sendUpcomingShiftAlerts(now: Date): Promise<{ sent: number; failed: number }> {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return { sent: 0, failed: 0 };

  const shifts = await prisma.shift.findMany({
    where: {
      cancelledAt: null,
      startTime: { gte: now, lte: new Date(now.getTime() + FIVE_MINUTES_MS) },
      preShiftLineAlert: null,
      clockRecords: { none: { type: "IN" } },
      staff: { status: "ACTIVE", simpleMode: false, lineGroupId: { not: null } },
    },
    include: { staff: true },
    orderBy: { startTime: "asc" },
  });

  let sent = 0;
  let failed = 0;
  for (const shift of shifts) {
    if (!isUpcomingShift(now, shift.startTime)) continue;
    const groupId = shift.staff.lineGroupId;
    if (!groupId) continue;

    try {
      await prisma.preShiftLineAlert.create({ data: { shiftId: shift.id } });
    } catch (error) {
      if (isUniqueConflict(error)) continue;
      throw error;
    }

    const message = [
      `【出勤5分前アラート】${shift.staff.name}さん`,
      `出勤予定 ${toJstTimeValue(shift.startTime)} / ${shift.storeName}`,
      "出勤時刻が近づいています。出勤打刻をお願いします。",
      `▼打刻はこちら\n${STAFF_CLOCK_URL}`,
    ].join("\n");
    if (await sendLinePush(groupId, message, `pre-shift:${shift.id}`)) {
      sent++;
    } else {
      await prisma.preShiftLineAlert.delete({ where: { shiftId: shift.id } });
      failed++;
    }
  }
  return { sent, failed };
}

function splitMessage(lines: string[], maxLength = 4500): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    if (current && current.length + line.length + 1 > maxLength) {
      chunks.push(current);
      current = "";
    }
    current += (current ? "\n" : "") + line;
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function sendDailyShiftSummary(now: Date): Promise<"skipped" | "sent" | "failed"> {
  if (!isDailySummaryWindow(now) || !process.env.LINE_CHANNEL_ACCESS_TOKEN) return "skipped";

  const group = await prisma.lineDailySummaryGroup.findUnique({ where: { id: "main" } });
  if (!group?.groupId) return "skipped";

  const dateKey = toJstDateValue(now);
  const { start, end } = jstDayRange(now);
  const shifts = await prisma.shift.findMany({
    where: { cancelledAt: null, startTime: { gte: start, lt: end }, staff: { status: "ACTIVE" } },
    include: { staff: true },
    orderBy: [{ startTime: "asc" }, { staff: { name: "asc" } }],
  });

  try {
    await prisma.lineDailySummary.create({ data: { dateKey, groupId: group.groupId } });
  } catch (error) {
    if (isUniqueConflict(error)) return "skipped";
    throw error;
  }

  const uniqueStaff = new Set(shifts.map((shift) => shift.staffId));
  const lines = [
    `【本日の出勤予定】${formatJstDate(now)}`,
    `予定者 ${uniqueStaff.size}名 / シフト ${shifts.length}件`,
    "",
    ...(shifts.length
      ? shifts.map((shift) => `${toJstTimeValue(shift.startTime)}〜${toJstTimeValue(shift.endTime)} ${shift.staff.name} / ${shift.storeName}`)
      : ["本日の出勤予定者はいません。"]),
  ];

  const chunks = splitMessage(lines);
  for (let i = 0; i < chunks.length; i++) {
    if (!await sendLinePush(group.groupId, chunks[i], `daily-summary:${dateKey}:${group.groupId}:${i}`)) {
      await prisma.lineDailySummary.delete({ where: { dateKey } });
      return "failed";
    }
  }
  return "sent";
}
