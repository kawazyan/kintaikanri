"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expensePasswordMatches, isExpenseUnlocked, lockExpenses, unlockExpenses } from "@/lib/expense-gate";
import { parseCompanyExpense } from "@/lib/company-expense";

export type ExpenseFormState = { error?: string; savedAt?: number };

const PATH = "/admin/company-expenses";

export async function unlockCompanyExpenses(_prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  await requireAdmin();
  const input = String(formData.get("password") ?? "");
  if (!expensePasswordMatches(input)) {
    // 総当たりを遅くするため、失敗したら少し待たせる。
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return { error: "パスワードが違います。" };
  }
  await unlockExpenses();
  revalidatePath(PATH);
  return { savedAt: Date.now() };
}

export async function lockCompanyExpenses() {
  await requireAdmin();
  await lockExpenses();
  revalidatePath(PATH);
}

export async function addCompanyExpense(_prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  await requireAdmin();
  if (!(await isExpenseUnlocked())) return { error: "ロックされています。パスワードを入力し直してください。" };

  const parsed = parseCompanyExpense({
    expenseDate: String(formData.get("expenseDate") ?? ""),
    category: String(formData.get("category") ?? ""),
    item: String(formData.get("item") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    recurring: formData.get("recurring") === "on",
    memo: String(formData.get("memo") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  await prisma.companyExpense.create({ data: parsed.value });
  revalidatePath(PATH);
  return { savedAt: Date.now() };
}

export async function deleteCompanyExpense(id: string) {
  await requireAdmin();
  if (!(await isExpenseUnlocked())) return;
  await prisma.companyExpense.deleteMany({ where: { id } });
  revalidatePath(PATH);
}
