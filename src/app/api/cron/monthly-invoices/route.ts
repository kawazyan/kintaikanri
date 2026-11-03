import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NO_BILLABLE_WORK_MESSAGE, buildInvoiceDraft } from "@/lib/invoice-draft";
import { invoiceTargetClientIds } from "@/lib/monthly-invoice-targets";
import { currentJstYearMonth } from "@/lib/time";
import { INVOICE_KIND_WORK } from "@/lib/invoice-kind";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// 前月(JST)の請求下書きを、承認済み稼働依頼のある取引先と、その月に有効な契約ルール(billingTerms.shiftBilling)のある取引先ぶん自動作成する。
// ・稼働(稼働依頼・契約ルールに合う稼働実績)がない取引先は作らず、skipped に入れる
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

  const clients = await prisma.client.findMany({ select: { id: true, active: true, billingTerms: true } });
  const targetIds = invoiceTargetClientIds(orders.map((o) => o.clientId), clients, yearMonth);

  const created: { clientId: string; invoiceNumber: string }[] = [];
  const skipped: string[] = [];
  const failed: { clientId: string; error: string }[] = [];

  for (const clientId of targetIds) {
    const exists = await prisma.invoice.findFirst({ where: { clientId, yearMonth, kind: INVOICE_KIND_WORK }, select: { id: true } }); // 別途請求だけがある月でも、稼働分の下書きは作る
    if (exists) {
      skipped.push(clientId);
      continue;
    }
    try {
      const { invoiceNumber } = await buildInvoiceDraft(clientId, yearMonth);
      created.push({ clientId, invoiceNumber });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // 契約はあるが、その月の稼働がない取引先は、失敗ではなくスキップ。
      if (message === NO_BILLABLE_WORK_MESSAGE) skipped.push(clientId);
      else failed.push({ clientId, error: message });
    }
  }

  return NextResponse.json({ yearMonth, created, skipped, failed });
}
