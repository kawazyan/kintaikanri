"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInvoiceDraft } from "@/lib/invoice-draft";

export async function createInvoiceDraft(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId") || "");
  const yearMonth = String(formData.get("yearMonth") || "");
  const { id } = await buildInvoiceDraft(clientId, yearMonth);
  revalidatePath("/admin/invoices");
  return id;
}

export async function finalizeInvoice(id: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("finalizedBy") || "").trim();
  if (!name) throw new Error("請求確定者名は必須です。");
  const current = await prisma.invoice.findUnique({ where: { id }, select: { revision: true } });
  if (!current) throw new Error("請求書が見つかりません。");
  await prisma.invoice.update({
    where: { id },
    data: { status: current.revision > 1 ? "REISSUED" : "FINALIZED", finalizedAt: new Date(), finalizedBy: name },
  });
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath("/admin/invoices");
}
