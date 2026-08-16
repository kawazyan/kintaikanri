"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function addAdminEmail(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;
  await prisma.adminEmail.upsert({
    where: { email },
    update: {},
    create: { email },
  });
  revalidatePath("/admin/admins");
}

export async function deleteAdminEmail(id: string) {
  await requireAdmin();
  await prisma.adminEmail.delete({ where: { id } });
  revalidatePath("/admin/admins");
}
