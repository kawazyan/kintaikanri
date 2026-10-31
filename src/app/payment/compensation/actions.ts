"use server";

import { revalidatePath } from "next/cache";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { splitInclusiveTax } from "@/lib/billing";
import { parseCompensationItems } from "@/lib/compensation-items";

export type CompensationFormState = { error?: string; savedAt?: number };

// 申請の内訳(対象・金額・メモ)を1行ずつ受け取り、その合計を申請金額にする。
export async function addCompensationRequest(_prev: CompensationFormState, formData: FormData): Promise<CompensationFormState> {
  const staffId = await getStaffId();
  if (!staffId) return { error: "ログインが必要です。" };

  const yearMonth = String(formData.get("yearMonth") || "");
  const categoryRaw = String(formData.get("category") || "");
  const category = categoryRaw === "REFERRAL" || categoryRaw === "INCENTIVE" || categoryRaw === "OTHER" ? categoryRaw : null;
  const description = String(formData.get("description") || "").trim() || null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth) || !category) return { error: "対象月と区分を確認してください。" };

  const parsed = parseCompensationItems(
    formData.getAll("itemLabel").map(String),
    formData.getAll("itemAmount").map(String),
    formData.getAll("itemMemo").map(String),
  );
  if (!parsed.ok) return { error: parsed.error };

  const { amountEx, tax } = splitInclusiveTax(parsed.total, 10);

  await prisma.compensationRequest.create({
    data: {
      staffId,
      yearMonth,
      category,
      description,
      amountTaxInclusive: parsed.total,
      amountExTax: amountEx,
      taxAmount: tax,
      taxRate: 10,
      status: "SUBMITTED",
      submittedAt: new Date(),
      items: { create: parsed.items.map((it, i) => ({ sortOrder: i, label: it.label, amount: it.amount, memo: it.memo })) },
    },
  });

  revalidatePath("/payment/compensation");
  revalidatePath("/admin/compensation");
  return { savedAt: Date.now() };
}

export async function deleteDraftCompensationRequest(id: string) {
  const staffId = await getStaffId();
  if (!staffId) throw new Error("ログインが必要です。");
  await prisma.compensationRequest.deleteMany({ where: { id, staffId, status: "DRAFT" } });
  revalidatePath("/payment/compensation");
}
