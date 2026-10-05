import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLineReply } from "@/lib/line";

export const dynamic = "force-dynamic";

type LineEvent = {
  type?: string;
  source?: { type?: string; groupId?: string };
  replyToken?: string;
  message?: { type?: string; text?: string };
};

function validSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(req: NextRequest) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const body = await req.text();
  if (!validSignature(body, req.headers.get("x-line-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let events: LineEvent[];
  try {
    const parsed = JSON.parse(body) as { events?: LineEvent[] };
    events = Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  for (const event of events) {
    const groupId = event.source?.type === "group" ? event.source.groupId : undefined;
    if (!groupId) continue;

    if (event.type === "leave") {
      await prisma.staff.updateMany({ where: { lineGroupId: groupId }, data: { lineGroupId: null } });
      await prisma.lineDailySummaryGroup.updateMany({ where: { groupId }, data: { groupId: null } });
      continue;
    }

    if (event.type !== "message" || event.message?.type !== "text") continue;

    const dailyMatch = /^日報連携\s+([a-f0-9]{32})$/i.exec(event.message.text?.trim() ?? "");
    if (dailyMatch) {
      const code = dailyMatch[1].toLowerCase();
      const dailyGroup = await prisma.lineDailySummaryGroup.findUnique({ where: { linkCode: code } });
      let reply = "連携コードを確認できませんでした。管理画面で新しいコードを発行してください。";
      // 従業員の出勤アラート用グループと同じグループを、毎朝の一覧にも使える。
      if (dailyGroup) {
        await prisma.lineDailySummaryGroup.update({ where: { id: dailyGroup.id }, data: { groupId, linkCode: null } });
        reply = "毎朝9時の出勤予定者一覧を、このグループに連携しました。";
      }
      if (event.replyToken) await sendLineReply(event.replyToken, reply);
      continue;
    }

    const match = /^勤怠連携\s+([a-f0-9]{32})$/i.exec(event.message.text?.trim() ?? "");
    if (!match) continue;

    const code = match[1].toLowerCase();
    const staff = await prisma.staff.findUnique({ where: { lineLinkCode: code }, select: { id: true, name: true } });
    const alreadyAssigned = await prisma.staff.findUnique({ where: { lineGroupId: groupId }, select: { id: true } });
    let reply = "連携コードを確認できませんでした。管理画面で新しいコードを発行してください。";

    if (staff && (!alreadyAssigned || alreadyAssigned.id === staff.id)) {
      const result = await prisma.staff.updateMany({
        where: { id: staff.id, lineLinkCode: code },
        data: { lineGroupId: groupId, lineLinkCode: null },
      });
      if (result.count === 1) reply = `${staff.name}さんの出勤前アラートを、このグループに連携しました。`;
    } else if (alreadyAssigned) {
      reply = "このグループは別の従業員に連携されています。管理画面で先に解除してください。";
    }

    if (event.replyToken) await sendLineReply(event.replyToken, reply);
  }

  return NextResponse.json({ ok: true });
}
