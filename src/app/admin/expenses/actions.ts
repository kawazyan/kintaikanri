"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { splitInclusiveTax } from "@/lib/billing";
import { expenseCategoryText, recordAudit, yenText } from "@/lib/audit";

export async function reviewExpense(id: string, decision: "APPROVED" | "REJECTED", formData: FormData) {
  await requireAdmin();
  const reviewer = String(formData.get("reviewerName") || "").trim();
  if (!reviewer) throw new Error("確認者名は必須です");
  const amount = Number(formData.get("amountTaxInclusive"));
  const note = String(formData.get("reviewNote") || "").trim() || null;
  const current = await prisma.expense.findUnique({ where: { id } });
  if (!current) return;
  const finalAmount = Number.isFinite(amount) && amount >= 0 ? amount : current.amountTaxInclusive;
  const { amountEx, tax } = splitInclusiveTax(finalAmount, current.taxRate);
  await prisma.expense.update({
    where: { id },
    data: { status: decision, amountTaxInclusive: finalAmount, amountExTax: amountEx, taxAmount: tax, reviewedAt: new Date(), reviewerName: reviewer, reviewNote: note },
  });
  await recordAudit({
    staffId: current.staffId,
    category: "EXPENSE",
    action: decision === "APPROVED" ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED",
    summary: `経費(${expenseCategoryText(current.category)})を${decision === "APPROVED" ? "承認" : "却下"}(金額 ${current.amountTaxInclusive === finalAmount ? yenText(finalAmount) : `${yenText(current.amountTaxInclusive)} → ${yenText(finalAmount)}`}${note ? `・メモ: ${note}` : ""})`,
    before: { status: current.status, amountTaxInclusive: current.amountTaxInclusive },
    after: { status: decision, amountTaxInclusive: finalAmount },
    yearMonth: current.yearMonth,
    actor: { type: "ADMIN", operatorName: reviewer },
  });
  revalidatePath("/admin/expenses");
}
