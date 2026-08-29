import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { formatJst } from "@/lib/time";
import { WORK_TYPE_LABEL } from "@/lib/carriers";

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
  const deadline = new Date(now.getTime() - GRACE_PERIOD_MS);
  const earliest = new Date(now.getTime() - LOOKBACK_MS);

  const overdueShifts = await prisma.shift.findMany({
    where: {
      cancelledAt: null,
      startTime: { gte: earliest, lte: deadline },
      noShowAlert: null,
      clockRecords: { none: { type: "IN" } },
    },
    include: { staff: true },
  });

  const admins = await prisma.adminEmail.findMany();
  let sent = 0;

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
  }

  return NextResponse.json({ checked: overdueShifts.length, sent });
}
