"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { newViewToken } from "@/lib/client-view";

export async function adminBulkDeleteClients(clientIds: string[]) {
  await requireAdmin();
  if (!clientIds.length) return { deleted: 0, blocked: 0 };

  let deleted = 0;
  let blocked = 0;
  for (const id of clientIds) {
    try {
      // 稼働依頼・請求書などが紐付いている取引先は外部キー制約で削除できない。
      await prisma.client.delete({ where: { id } });
      deleted += 1;
    } catch {
      blocked += 1;
    }
  }

  revalidatePath("/admin/clients");
  return { deleted, blocked };
}

// 取引先向け「出退勤の閲覧専用ページ」のURLを発行する。再発行すると、これまでのURLは使えなくなる。
export async function adminIssueClientViewToken(clientId: string) {
  await requireAdmin();
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new Error("取引先が見つかりません。");
  await prisma.$transaction([
    prisma.clientViewToken.updateMany({ where: { clientId, active: true }, data: { active: false, revokedAt: new Date() } }),
    prisma.clientViewToken.create({ data: { clientId, token: newViewToken() } }),
  ]);
  revalidatePath("/admin/clients");
}

// 閲覧専用ページのURLを止める(誰も見られなくなる)。
export async function adminRevokeClientViewToken(clientId: string) {
  await requireAdmin();
  await prisma.clientViewToken.updateMany({ where: { clientId, active: true }, data: { active: false, revokedAt: new Date() } });
  revalidatePath("/admin/clients");
}
