import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLineReply } from "@/lib/line";
import { identifyChannel } from "@/lib/line-webhook-auth";

export const dynamic = "force-dynamic";

type LineEvent = {
  type?: string;
  source?: { type?: string; groupId?: string };
  replyToken?: string;
  message?: { type?: string; text?: string };
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  // 署名から、どの公式アカウント(default=勤怠用 / manager=毎朝の一覧用)からの通知かを判定する。
  const { configured, channel } = identifyChannel(body, req.headers.get("x-line-signature"));
  if (!configured) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!channel) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

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
      // 従業員のグループは勤怠用(default)アカウントだけが管理する。manager の退出で従業員の連携は外さない。
      if (channel === "default") {
        await prisma.staff.updateMany({ where: { lineGroupId: groupId }, data: { lineGroupId: null } });
      }
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
      // 返信は、通知を受け取った公式アカウントのトークンで送る(replyTokenはそのアカウント専用)。
      if (event.replyToken) await sendLineReply(event.replyToken, reply, channel);
      continue;
    }

    // 従業員の連携(勤怠連携)は勤怠用(default)アカウントのグループだけ。manager のグループでは受け付けない。
    if (channel !== "default") continue;
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
