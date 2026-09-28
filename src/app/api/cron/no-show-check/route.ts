import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { formatJst } from "@/lib/time";
import { WORK_TYPE_LABEL } from "@/lib/carriers";
import { sendLinePush } from "@/lib/line";
import { sendDailyShiftSummary, sendUpcomingShiftAlerts } from "@/lib/line-schedule";

export const dynamic = "force-dynamic";

const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
const LOOKBACK_MS = 24 * 60 * 60 * 1000; // ignore shifts older than this

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const upcoming = await sendUpcomingShiftAlerts(now);
  const dailySummary = await sendDailyShiftSummary(now);
  const deadline = new Date(now.getTime() - GRACE_PERIOD_MS);
  const earliest = new Date(now.getTime() - LOOKBACK_MS);

  const overdueShifts = await prisma.shift.findMany({
    where: {
      cancelledAt: null,
      startTime: { gte: earliest, lte: deadline },
      noShowAlert: null,
      clockRecords: { none: { type: "IN" } },
    },
    include: { staff: true, lineAlert: true },
  });

  const admins = await prisma.adminEmail.findMany();
  let sent = 0;
  let lineSent = 0;
  let lineFailed = 0;

  for (const shift of overdueShifts) {
    if (shift.staff.status !== "ACTIVE") continue;

    const subject = `【勤怠管理】未出勤アラート: ${shift.staff.name}`;
    const text = [
      `${shift.staff.name} さん(社員コード: ${shift.staff.employeeCode})が`,
      `出勤予定時刻(${formatJst(shift.startTime)})を過ぎても出勤打刻がありません。`,
      "",
      `区分: ${WORK_TYPE_LABEL[shift.workType]}`,
      `キャリア: ${shift.carrier}`,
      `店舗: ${shift.storeName}`,
    ].join("\n");

    const recipients = [shift.staff.email, ...admins.map((a) => a.email)];
    await sendMail({ to: recipients, subject, text });

    await prisma.noShowAlert.create({ data: { shiftId: shift.id } });
    sent += 1;

    if (!shift.lineAlert && shift.staff.lineGroupId && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      // 送信前にレコードを確保しておき、失敗時のみ取り消す(=重複送信の防止)。
      let claimed = false;
      try {
        await prisma.lineAlert.create({ data: { shiftId: shift.id } });
        claimed = true;
      } catch (error) {
        if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") throw error;
      }
      if (claimed) {
        if (await sendLinePush(shift.staff.lineGroupId, `${subject}\n${text}`, shift.id)) {
          lineSent += 1;
        } else {
          await prisma.lineAlert.delete({ where: { shiftId: shift.id } });
          lineFailed += 1;
        }
      }
    }
  }

  return NextResponse.json({ checked: overdueShifts.length, sent, lineSent, lineFailed, preShiftLineSent: upcoming.sent, preShiftLineFailed: upcoming.failed, dailySummary });
}
