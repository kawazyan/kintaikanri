"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
