"use server";
import { revalidatePath } from "next/cache";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { splitInclusiveTax } from "@/lib/billing";

export async function addExpense(formData: FormData) {
  const staffId = await getStaffId();
  if (!staffId) throw new Error("ログインが必要です。");
  const amount = Number(formData.get("amountTaxInclusive"));
  const category = String(formData.get("category")) as "TRAVEL"|"LODGING"|"OTHER";
  const yearMonth = String(formData.get("yearMonth")||"");
  const expenseDate = String(formData.get("expenseDate")||"");
  const description = String(formData.get("description")||"").trim() || null;
  const workOrderStaffId = String(formData.get("workOrderStaffId")||"") || null;
  if (!yearMonth || !expenseDate || !Number.isFinite(amount) || amount < 0) throw new Error("入力内容を確認してください。");
  if (category === "OTHER" && !description) throw new Error("その他経費は内容を入力してください。");
  const { amountEx, tax } = splitInclusiveTax(amount, 10);
  await prisma.expense.create({data:{staffId,workOrderStaffId,yearMonth,expenseDate:new Date(`${expenseDate}T12:00:00+09:00`),category,description,amountTaxInclusive:amount,amountExTax:amountEx,taxAmount:tax,taxRate:10,status:"SUBMITTED",submittedAt:new Date()}});
  revalidatePath("/expenses");
}

export async function deleteDraftExpense(id:string) {
  const staffId=await getStaffId(); if(!staffId) throw new Error("ログインが必要です。");
  await prisma.expense.deleteMany({where:{id,staffId,status:"DRAFT"}}); revalidatePath("/expenses");
}
