"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function markTransferRequestPaid(requestId: string, formData: FormData) {
  await requireAdmin();

  const operatorName = String(formData.get("operatorName") ?? "").trim();
  const paidAmountRaw = String(formData.get("paidAmount") ?? "").trim();

  const existing = await prisma.transferRequest.findUnique({ where: { id: requestId } });
  if (!existing || existing.status === "PAID") return;

  const paidAmount = paidAmountRaw ? Number(paidAmountRaw) : existing.amount;
  if (!Number.isInteger(paidAmount) || paidAmount <= 0) return;

  await prisma.transferRequest.update({
    where: { id: requestId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paidAmount,
      paidByOperatorName: operatorName || null,
    },
  });

  revalidatePath("/admin/payments");
}
