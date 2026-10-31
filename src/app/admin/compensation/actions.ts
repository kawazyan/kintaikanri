"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { splitInclusiveTax } from "@/lib/billing";

export async function reviewCompensationRequest(id: string, decision: "APPROVED" | "REJECTED", formData: FormData) {
  await requireAdmin();
  const reviewer = String(formData.get("reviewerName") || "").trim();
  if (!reviewer) throw new Error("確認者名は必須です");
  const amount = Number(formData.get("amountTaxInclusive"));
  const note = String(formData.get("reviewNote") || "").trim() || null;
  const current = await prisma.compensationRequest.findUnique({ where: { id } });
  if (!current) return;
  const finalAmount = Number.isFinite(amount) && amount >= 0 ? amount : current.amountTaxInclusive;
  const { amountEx, tax } = splitInclusiveTax(finalAmount, current.taxRate);
  await prisma.compensationRequest.update({
    where: { id },
    data: {
      status: decision,
      amountTaxInclusive: finalAmount,
      amountExTax: amountEx,
      taxAmount: tax,
      reviewedAt: new Date(),
      reviewerName: reviewer,
      reviewNote: note,
    },
  });
  revalidatePath("/admin/compensation");
}

// 承認済みの別途報酬に「振込済み」を記録する。振込額を空にすると申請金額(承認時の金額)が入る。
// 二重に押しても、すでに振込済みのものは変更しない。
export async function markCompensationPaid(id: string, formData: FormData) {
  await requireAdmin();
  const operatorName = String(formData.get("operatorName") || "").trim();
  const amountRaw = String(formData.get("paidAmount") || "").replace(/[,，\s]/g, "");

  const current = await prisma.compensationRequest.findUnique({ where: { id } });
  if (!current || current.status !== "APPROVED" || current.paidAt) return;

  const paidAmount = amountRaw ? Number(amountRaw) : current.amountTaxInclusive;
  if (!Number.isInteger(paidAmount) || paidAmount <= 0 || paidAmount > 100_000_000) return;

  await prisma.compensationRequest.updateMany({
    where: { id, status: "APPROVED", paidAt: null },
    data: { paidAt: new Date(), paidAmount, paidByOperatorName: operatorName || null },
  });
  revalidatePath("/admin/compensation");
}

// 押し間違い用の取り消し(未振込に戻す)。
export async function undoCompensationPaid(id: string) {
  await requireAdmin();
  await prisma.compensationRequest.updateMany({
    where: { id, paidAt: { not: null } },
    data: { paidAt: null, paidAmount: null, paidByOperatorName: null },
  });
  revalidatePath("/admin/compensation");
}
