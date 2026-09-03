"use server";

import { revalidatePath } from "next/cache";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { splitInclusiveTax } from "@/lib/billing";

export async function addCompensationRequest(formData: FormData) {
  const staffId = await getStaffId();
  if (!staffId) throw new Error("ログインが必要です。");

  const yearMonth = String(formData.get("yearMonth") || "");
  const category = String(formData.get("category")) as "REFERRAL" | "INCENTIVE" | "OTHER";
  const amount = Number(formData.get("amountTaxInclusive"));
  const description = String(formData.get("description") || "").trim() || null;

  if (!yearMonth || !Number.isFinite(amount) || amount < 0) {
    throw new Error("入力内容を確認してください。");
  }

  const { amountEx, tax } = splitInclusiveTax(amount, 10);

  await prisma.compensationRequest.create({
    data: {
      staffId,
      yearMonth,
      category,
      description,
      amountTaxInclusive: amount,
      amountExTax: amountEx,
      taxAmount: tax,
      taxRate: 10,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  revalidatePath("/payment/compensation");
}

export async function deleteDraftCompensationRequest(id: string) {
  const staffId = await getStaffId();
  if (!staffId) throw new Error("ログインが必要です。");
  await prisma.compensationRequest.deleteMany({ where: { id, staffId, status: "DRAFT" } });
  revalidatePath("/payment/compensation");
}
