"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createClient(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const clientCode = String(formData.get("clientCode") ?? "").trim();
  if (!name || !clientCode) throw new Error("取引先名と取引先コードは必須です。");
  const token = randomBytes(24).toString("hex");
  await prisma.client.create({
    data: {
      name, clientCode,
      contactName: String(formData.get("contactName") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      accessTokens: { create: { token } },
    },
  });
  revalidatePath("/admin/clients");
}

export async function rotateClientToken(clientId: string) {
  await requireAdmin();
  const token = randomBytes(24).toString("hex");
  await prisma.$transaction([
    prisma.clientAccessToken.updateMany({ where: { clientId, active: true }, data: { active: false, revokedAt: new Date() } }),
    prisma.clientAccessToken.create({ data: { clientId, token } }),
  ]);
  revalidatePath("/admin/clients");
}

export async function stopClientSharing(clientId: string) {
  await requireAdmin();
  await prisma.clientAccessToken.updateMany({ where: { clientId, active: true }, data: { active: false, revokedAt: new Date() } });
  revalidatePath("/admin/clients");
}
