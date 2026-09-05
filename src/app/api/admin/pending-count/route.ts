import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 管理者ナビの「申請・報告管理」バッジ用。未対応件数だけを軽量に返す。
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [reportCount, requestCount] = await Promise.all([
    prisma.irregularReport.count({ where: { status: { not: "RESOLVED" } } }),
    prisma.shiftChangeRequest.count({ where: { status: "PENDING" } }),
  ]);

  return NextResponse.json({ count: reportCount + requestCount });
}
