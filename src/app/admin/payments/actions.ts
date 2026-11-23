"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeMonthlyEarnings } from "@/lib/earnings";
import { sumPayableAdditions } from "@/lib/staff-month-summary";
import { operatorNameFrom, recordAudit, yenText, ymText } from "@/lib/audit";
import { toJstDateValue } from "@/lib/time";

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
  await recordAudit({
    staffId: existing.staffId,
    category: "TRANSFER",
    action: "REQUEST_PAID",
    summary: `振込完了を記録(申請 ${yenText(existing.amount)} → 振込金額 ${yenText(paidAmount)}・希望振込日 ${toJstDateValue(existing.desiredPaymentDate)})`,
    before: { status: existing.status, amount: existing.amount },
    after: { status: "PAID", paidAmount, desiredPaymentDate: toJstDateValue(existing.desiredPaymentDate) },
    actor: { type: "ADMIN", operatorName },
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}

// 振込申請の「却下」。申請中のものだけ却下できる(振込済みは対象外)。却下した申請は申請可能額に数えない(スタッフはまた申請できる)。
export async function rejectTransferRequest(requestId: string, formData: FormData) {
  await requireAdmin();

  const reason = String(formData.get("reason") ?? "").trim();
  const operatorName = String(formData.get("operatorName") ?? "").trim();

  const target = await prisma.transferRequest.findUnique({ where: { id: requestId }, select: { staffId: true, amount: true, status: true } });

  // 申請中のときだけ更新(同時に振込完了が押された場合などに上書きしない)。
  const rejected = await prisma.transferRequest.updateMany({
    where: { id: requestId, status: "REQUESTING" },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: reason || null,
      rejectedByOperatorName: operatorName || null,
    },
  });
  if (rejected.count > 0 && target) {
    await recordAudit({
      staffId: target.staffId,
      category: "TRANSFER",
      action: "REQUEST_REJECTED",
      summary: `振込申請を却下(申請 ${yenText(target.amount)}${reason ? `・理由: ${reason}` : ""})`,
      before: { status: target.status, amount: target.amount },
      after: { status: "REJECTED", reason: reason || null },
      actor: { type: "ADMIN", operatorName },
    });
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  revalidatePath("/payment/history");
  revalidatePath("/clock");
}

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// 固定支払の「振込完了」ボタン。押した時点の支払い金額(受取金額+申請のある経費)を記録する。
// 金額が確定していない(計算できない)月は記録しない。二重に押しても1件のまま(上書きしない)。
export async function markFixedPaymentDone(staffId: string, closingYearMonth: string, formData: FormData) {
  await requireAdmin();
  if (!YEAR_MONTH_RE.test(closingYearMonth)) return;
  const operatorName = operatorNameFrom(formData);

  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true, paymentMethod: true } });
  if (!staff || staff.paymentMethod !== "FIXED") return;

  const { confirmedAmount } = await computeMonthlyEarnings(staffId, closingYearMonth, new Date());
  if (confirmedAmount === null) return;
  const additions = await sumPayableAdditions(staffId, closingYearMonth);
  const paidAmount = confirmedAmount + additions;
  // すでに記録済みなら、記録は上書きしない(履歴も重ねて残さない)。
  const alreadyDone = await prisma.fixedPaymentCompletion.findUnique({ where: { staffId_closingYearMonth: { staffId, closingYearMonth } }, select: { id: true } });

  // 振込完了に含めた別途報酬(承認済・未振込)は、同じ振込で払ったものとして振込済みにする(二重払い防止)。
  await prisma.$transaction([
    prisma.fixedPaymentCompletion.upsert({
      where: { staffId_closingYearMonth: { staffId, closingYearMonth } },
      update: {},
      create: { staffId, closingYearMonth, paidAmount },
    }),
    prisma.compensationRequest.updateMany({
      where: { staffId, yearMonth: closingYearMonth, status: "APPROVED", paidAt: null },
      data: { paidAt: new Date(), paidAmount: null, paidByOperatorName: "固定支払の振込完了に含む" },
    }),
  ]);
  if (!alreadyDone) {
    await recordAudit({
      staffId,
      category: "TRANSFER",
      action: "FIXED_PAID",
      summary: `${ymText(closingYearMonth)}分の振込完了を記録(振込金額 ${yenText(paidAmount)} = 受取 ${yenText(confirmedAmount)} + 経費・別途報酬 ${yenText(additions)})`,
      after: { paidAmount, earnings: confirmedAmount, expensesAndCompensation: additions },
      yearMonth: closingYearMonth,
      actor: { type: "ADMIN", operatorName },
    });
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}

// 報酬タイプ「月ごとに手入力」のスタッフの、その月(締め月)の支払い金額を入力する。
// 空欄で保存すると未入力に戻す。振込完了を押した後の月は、記録済みの金額を守るため変更しない。
export async function setManualPayAmount(staffId: string, yearMonth: string, formData: FormData) {
  await requireAdmin();
  if (!YEAR_MONTH_RE.test(yearMonth)) return;
  const operatorName = operatorNameFrom(formData);

  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { payType: true } });
  if (!staff || staff.payType !== "MANUAL") return;

  const done = await prisma.fixedPaymentCompletion.findUnique({ where: { staffId_closingYearMonth: { staffId, closingYearMonth: yearMonth } } });
  if (done) return;

  const beforeRow = await prisma.manualPayAmount.findUnique({ where: { staffId_yearMonth: { staffId, yearMonth } } });
  const raw = String(formData.get("amount") ?? "").replace(/[,，\s]/g, "");
  let afterAmount: number | null = null;
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
    afterAmount = amount;
  }
  if ((beforeRow?.amount ?? null) !== afterAmount) {
    await recordAudit({
      staffId,
      category: "AMOUNT_SETTING",
      action: "SET_MANUAL_PAY",
      summary: `${ymText(yearMonth)}分の支払い金額(手入力)を変更: ${beforeRow ? yenText(beforeRow.amount) : "未入力"} → ${afterAmount === null ? "未入力" : yenText(afterAmount)}`,
      before: { amount: beforeRow?.amount ?? null },
      after: { amount: afterAmount },
      yearMonth,
      actor: { type: "ADMIN", operatorName },
    });
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}

// その月の報酬の満額(MAX額)を管理者が入力する。BAND/月固定の人の「受取金額」は、この額を出勤日数で按分(全日出勤なら満額)して計算する。
// 空欄で保存すると未入力に戻す(報酬設定の月額を使う)。振込完了を押した後の月は、記録済みの金額を守るため変更しない。
export async function setMonthlyMaxAmount(staffId: string, yearMonth: string, formData: FormData) {
  await requireAdmin();
  if (!YEAR_MONTH_RE.test(yearMonth)) return;
  const operatorName = operatorNameFrom(formData);

  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { payType: true } });
  if (!staff || staff.payType === "MANUAL" || staff.payType === "DAILY") return;

  const done = await prisma.fixedPaymentCompletion.findUnique({ where: { staffId_closingYearMonth: { staffId, closingYearMonth: yearMonth } } });
  if (done) return;

  const raw = String(formData.get("amount") ?? "").replace(/[,，\s円¥￥]/g, "").replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10));
  const beforeTarget = await prisma.monthlyEarningTarget.findUnique({ where: { staffId_yearMonth: { staffId, yearMonth } } });
  let afterTarget: number | null = null;
  if (raw === "") {
    await prisma.monthlyEarningTarget.deleteMany({ where: { staffId, yearMonth } });
  } else {
    const amount = Number(raw);
    if (!Number.isInteger(amount) || amount < 0 || amount > 100_000_000) return;
    await prisma.monthlyEarningTarget.upsert({
      where: { staffId_yearMonth: { staffId, yearMonth } },
      update: { targetAmount: amount },
      create: { staffId, yearMonth, targetAmount: amount },
    });
    afterTarget = amount;
  }
  if ((beforeTarget?.targetAmount ?? null) !== afterTarget) {
    await recordAudit({
      staffId,
      category: "AMOUNT_SETTING",
      action: "SET_MONTHLY_MAX",
      summary: `${ymText(yearMonth)}分の月の満額を変更: ${beforeTarget ? yenText(beforeTarget.targetAmount) : "未入力(報酬設定の月額)"} → ${afterTarget === null ? "未入力(報酬設定の月額)" : yenText(afterTarget)}`,
      before: { targetAmount: beforeTarget?.targetAmount ?? null },
      after: { targetAmount: afterTarget },
      yearMonth,
      actor: { type: "ADMIN", operatorName },
    });
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  revalidatePath("/clock");
}

// 押し間違い用の取り消し(未振込に戻す)。
export async function undoFixedPaymentDone(staffId: string, closingYearMonth: string, formData: FormData) {
  await requireAdmin();
  if (!YEAR_MONTH_RE.test(closingYearMonth)) return;
  const operatorName = operatorNameFrom(formData);
  const done = await prisma.fixedPaymentCompletion.findUnique({ where: { staffId_closingYearMonth: { staffId, closingYearMonth } } });
  await prisma.fixedPaymentCompletion.deleteMany({ where: { staffId, closingYearMonth } });
  if (done) {
    await recordAudit({
      staffId,
      category: "TRANSFER",
      action: "FIXED_UNDO",
      summary: `${ymText(closingYearMonth)}分の振込完了の記録を取り消し(取り消した記録: 振込金額 ${yenText(done.paidAmount)})`,
      before: { paidAmount: done.paidAmount, paidAt: done.paidAt.toISOString() },
      yearMonth: closingYearMonth,
      actor: { type: "ADMIN", operatorName },
    });
  }
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}
