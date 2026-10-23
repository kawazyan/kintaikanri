"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeMonthlyEarnings } from "@/lib/earnings";
import { sumSubmittedExpenses } from "@/lib/staff-month-summary";

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
  revalidatePath("/admin");
}

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// 固定支払の「振込完了」ボタン。押した時点の支払い金額(受取金額+申請のある経費)を記録する。
// 金額が確定していない(計算できない)月は記録しない。二重に押しても1件のまま(上書きしない)。
export async function markFixedPaymentDone(staffId: string, closingYearMonth: string) {
  await requireAdmin();
  if (!YEAR_MONTH_RE.test(closingYearMonth)) return;

  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true, paymentMethod: true } });
  if (!staff || staff.paymentMethod !== "FIXED") return;

  const { confirmedAmount } = await computeMonthlyEarnings(staffId, closingYearMonth, new Date());
  if (confirmedAmount === null) return;
  const paidAmount = confirmedAmount + (await sumSubmittedExpenses(staffId, closingYearMonth));

  await prisma.fixedPaymentCompletion.upsert({
    where: { staffId_closingYearMonth: { staffId, closingYearMonth } },
    update: {},
    create: { staffId, closingYearMonth, paidAmount },
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}

// 押し間違い用の取り消し(未振込に戻す)。
export async function undoFixedPaymentDone(staffId: string, closingYearMonth: string) {
  await requireAdmin();
  if (!YEAR_MONTH_RE.test(closingYearMonth)) return;
  await prisma.fixedPaymentCompletion.deleteMany({ where: { staffId, closingYearMonth } });
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}
