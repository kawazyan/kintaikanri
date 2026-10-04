import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildInvoiceDraft } from "@/lib/invoice-draft";
import { currentJstYearMonth } from "@/lib/time";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// 前月(JST)の請求下書きを、承認済み稼働依頼のある全取引先ぶん自動作成する。
// ・すでにその月の請求(下書き・確定済みを問わず)がある取引先は作らない(何度呼んでも二重にならない)
// ・確定はしない(下書きまで)。金額と稼働明細書を管理画面で確認してから確定する
// 月初に1回呼ぶ想定。?yearMonth=YYYY-MM で対象月を指定することもできる。
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const param = req.nextUrl.searchParams.get("yearMonth");
  let yearMonth: string;
  if (param) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(param)) {
      return NextResponse.json({ error: "yearMonth は YYYY-MM 形式で指定してください" }, { status: 400 });
    }
    yearMonth = param;
  } else {
    const cur = currentJstYearMonth();
    const [y, m] = cur.split("-").map(Number);
    yearMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  }

  const orders = await prisma.workOrder.findMany({
    where: { yearMonth, status: { in: ["APPROVED", "CHANGES_PENDING", "TERMINATED"] } },
    select: { clientId: true },
    distinct: ["clientId"],
  });

  const created: { clientId: string; invoiceNumber: string }[] = [];
  const skipped: string[] = [];
  const failed: { clientId: string; error: string }[] = [];

  for (const { clientId } of orders) {
    const exists = await prisma.invoice.findFirst({ where: { clientId, yearMonth }, select: { id: true } });
    if (exists) {
      skipped.push(clientId);
      continue;
    }
    try {
      const { invoiceNumber } = await buildInvoiceDraft(clientId, yearMonth);
      created.push({ clientId, invoiceNumber });
    } catch (e) {
      failed.push({ clientId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ yearMonth, created, skipped, failed });
}
