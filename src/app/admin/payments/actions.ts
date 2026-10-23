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

// 振込申請の「却下」。申請中のものだけ却下できる(振込済みは対象外)。却下した申請は申請可能額に数えない(スタッフはまた申請できる)。
export async function rejectTransferRequest(requestId: string, formData: FormData) {
  await requireAdmin();

  const reason = String(formData.get("reason") ?? "").trim();
  const operatorName = String(formData.get("operatorName") ?? "").trim();

  // 申請中のときだけ更新(同時に振込完了が押された場合などに上書きしない)。
  await prisma.transferRequest.updateMany({
    where: { id: requestId, status: "REQUESTING" },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: reason || null,
      rejectedByOperatorName: operatorName || null,
    },
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  revalidatePath("/payment/history");
  revalidatePath("/clock");
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

// 報酬タイプ「月ごとに手入力」のスタッフの、その月(締め月)の支払い金額を入力する。
// 空欄で保存すると未入力に戻す。振込完了を押した後の月は、記録済みの金額を守るため変更しない。
export async function setManualPayAmount(staffId: string, yearMonth: string, formData: FormData) {
  await requireAdmin();
  if (!YEAR_MONTH_RE.test(yearMonth)) return;

  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { payType: true } });
  if (!staff || staff.payType !== "MANUAL") return;

  const done = await prisma.fixedPaymentCompletion.findUnique({ where: { staffId_closingYearMonth: { staffId, closingYearMonth: yearMonth } } });
  if (done) return;

  const raw = String(formData.get("amount") ?? "").replace(/[,，\s]/g, "");
  if (raw === "") {
    await prisma.manualPayAmount.deleteMany({ where: { staffId, yearMonth } });
  } else {
    const amount = Number(raw);
    if (!Number.isInteger(amount) || amount < 0 || amount > 100_000_000) return;
    await prisma.manualPayAmount.upsert({
      where: { staffId_yearMonth: { staffId, yearMonth } },
      update: { amount },
      create: { staffId, yearMonth, amount },
    });
  }

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
