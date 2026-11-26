"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadPayeeRows } from "@/lib/referral-payee";

// 「払った」を記録する。金額は押した時点の計算結果(後から請求書が変わっても、払った額は変わらない)。
export async function markPayeePaid(ruleId: string, workMonth: string, formData: FormData) {
  await requireAdmin();
  const operatorName = String(formData.get("operatorName") ?? "").trim();
  const rows = await loadPayeeRows();
  const row = rows.find((r) => r.ruleId === ruleId && r.workMonth === workMonth);
  if (!row || row.paid || row.amount === null) return;
  await prisma.referralPayeePaid.upsert({
    where: { ruleId_workMonth: { ruleId, workMonth } },
    create: { ruleId, workMonth, amount: row.amount, operatorName: operatorName || null },
    update: {},
  });
  revalidatePath("/admin/payments");
}

export async function undoPayeePaid(ruleId: string, workMonth: string) {
  await requireAdmin();
  await prisma.referralPayeePaid.deleteMany({ where: { ruleId, workMonth } });
  revalidatePath("/admin/payments");
}
