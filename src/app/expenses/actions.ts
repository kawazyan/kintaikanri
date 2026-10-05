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
  let yearMonth = String(formData.get("yearMonth")||"");
  let expenseDate = String(formData.get("expenseDate")||"");
  let description = String(formData.get("description")||"").trim() || null;
  // 交通費は、日付を入れずに「月」だけでも申請できる(月のまとめ申請)。日付はその月の1日で保存し、備考に「月のみ申請」と残す。
  if (!expenseDate) {
    const month = String(formData.get("expenseMonth")||"");
    if (category !== "TRAVEL") throw new Error("日付を入力してください(日付なしで申請できるのは交通費だけです)。");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("日付を入れない場合は、対象月を選んでください。");
    yearMonth = month;
    expenseDate = `${month}-01`;
    description = description ? `${description}（日付指定なし・月のみ申請）` : "日付指定なし・月のみ申請";
  }
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
