"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function issueLineLinkCode(formData: FormData) {
  await requireAdmin();
  const staffId = String(formData.get("staffId") ?? "");
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true, status: true } });
  if (!staff || staff.status !== "ACTIVE") return;
  await prisma.staff.update({
    where: { id: staffId },
    data: { lineLinkCode: randomBytes(16).toString("hex") },
  });
  revalidatePath("/admin/line");
}

export async function disconnectLineGroup(formData: FormData) {
  await requireAdmin();
  const staffId = String(formData.get("staffId") ?? "");
  await prisma.staff.update({ where: { id: staffId }, data: { lineGroupId: null, lineLinkCode: null } });
  revalidatePath("/admin/line");
}

export async function issueDailySummaryLinkCode() {
  await requireAdmin();
  await prisma.lineDailySummaryGroup.upsert({
    where: { id: "main" },
    create: { id: "main", linkCode: randomBytes(16).toString("hex") },
    update: { linkCode: randomBytes(16).toString("hex") },
  });
  revalidatePath("/admin/line");
}

export async function disconnectDailySummaryGroup() {
  await requireAdmin();
  await prisma.lineDailySummaryGroup.updateMany({
    where: { id: "main" },
    data: { groupId: null, linkCode: null },
  });
  revalidatePath("/admin/line");
}
