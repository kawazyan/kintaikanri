"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { combineJstDateAndTime, toJstDateValue, toJstTimeValue } from "@/lib/time";
import type { IrregularReportStatus } from "@prisma/client";

export async function updateIrregularReportStatus(
  id: string,
  status: IrregularReportStatus,
  formData: FormData
): Promise<void> {
  await requireAdmin();
  const reviewerName = String(formData.get("reviewerName") || "").trim();
  if (!reviewerName) throw new Error("確認者名は必須です");

  await prisma.irregularReport.update({
    where: { id },
    data: { status, reviewerName, reviewedAt: new Date() },
  });

  revalidatePath("/admin/attendance-requests");
}

// 変更後の時刻(HH:mm)をそのまま使い、開始<=終了で終電を跨ぐ場合は
// src/app/shift/actions.ts の buildShiftTimes と同じルールで翌日に繰り上げる。
function buildTimesOnDate(dateStr: string, startTimeStr: string, endTimeStr: string) {
  const startTime = combineJstDateAndTime(dateStr, startTimeStr);
  let endTime = combineJstDateAndTime(dateStr, endTimeStr);
  if (endTime <= startTime) {
    endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
  }
  return { startTime, endTime };
}

export async function approveShiftChangeRequest(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const reviewerName = String(formData.get("reviewerName") || "").trim();
  if (!reviewerName) throw new Error("承認者名は必須です");

  const request = await prisma.shiftChangeRequest.findUnique({ where: { id }, include: { shift: true } });
  if (!request) throw new Error("申請が見つかりません");
  if (request.status !== "PENDING") throw new Error("この申請はすでに処理済みです");
  if (!request.shift) throw new Error("対象シフトが見つかりません(削除済みの可能性があります)");

  const shift = request.shift;
  const now = new Date();

  if (request.kind === "TO_OFF") {
    await prisma.$transaction([
      prisma.shift.update({
        where: { id: shift.id },
        data: { cancelledAt: now, cancellationReason: `シフト変更申請による休み反映: ${request.reason}`, cancelledBy: reviewerName },
      }),
      prisma.shiftHistory.create({
        data: {
          shiftId: shift.id,
          staffId: shift.staffId,
          changeType: "UPDATE",
          before: JSON.parse(JSON.stringify(shift)),
          after: { cancelledAt: now.toISOString(), cancellationReason: request.reason },
        },
      }),
      prisma.shiftChangeRequest.update({
        where: { id },
        data: { status: "APPROVED", reviewerName, reviewedAt: now },
      }),
    ]);
  } else if (request.kind === "TRANSFER") {
    if (!request.transferDate) throw new Error("振替日が設定されていません");
    const durationMs = shift.endTime.getTime() - shift.startTime.getTime();
    const newStartTime = combineJstDateAndTime(toJstDateValue(request.transferDate), toJstTimeValue(shift.startTime));
    const newEndTime = new Date(newStartTime.getTime() + durationMs);

    await prisma.$transaction(async (tx) => {
      await tx.shift.update({
        where: { id: shift.id },
        data: { cancelledAt: now, cancellationReason: `シフト変更申請による振替: ${request.reason}`, cancelledBy: reviewerName },
      });
      await tx.shiftHistory.create({
        data: {
          shiftId: shift.id,
          staffId: shift.staffId,
          changeType: "UPDATE",
          before: JSON.parse(JSON.stringify(shift)),
          after: { cancelledAt: now.toISOString(), cancellationReason: request.reason },
        },
      });
      const newShift = await tx.shift.create({
        data: {
          staffId: shift.staffId,
          workType: shift.workType,
          carrier: shift.carrier,
          storeName: shift.storeName,
          startTime: newStartTime,
          endTime: newEndTime,
          unitAmount: shift.unitAmount,
        },
      });
      await tx.shiftHistory.create({
        data: {
          shiftId: newShift.id,
          staffId: shift.staffId,
          changeType: "CREATE",
          after: JSON.parse(JSON.stringify(newShift)),
        },
      });
      await tx.shiftChangeRequest.update({
        where: { id },
        data: { status: "APPROVED", reviewerName, reviewedAt: now },
      });
    });
  } else {
    const data: { startTime?: Date; endTime?: Date; storeName?: string } = {};

    if (request.kind === "DATE_CHANGE") {
      if (!request.newDate) throw new Error("変更後の勤務日が設定されていません");
      const durationMs = shift.endTime.getTime() - shift.startTime.getTime();
      data.startTime = combineJstDateAndTime(toJstDateValue(request.newDate), toJstTimeValue(shift.startTime));
      data.endTime = new Date(data.startTime.getTime() + durationMs);
    } else if (request.kind === "TIME_CHANGE") {
      if (!request.newStartTime || !request.newEndTime) throw new Error("変更後の勤務時間が設定されていません");
      const built = buildTimesOnDate(toJstDateValue(shift.startTime), request.newStartTime, request.newEndTime);
      data.startTime = built.startTime;
      data.endTime = built.endTime;
    } else if (request.kind === "LOCATION_CHANGE") {
      if (!request.newLocation) throw new Error("変更後の勤務場所が設定されていません");
      data.storeName = request.newLocation;
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.shift.update({ where: { id: shift.id }, data });
      await tx.shiftHistory.create({
        data: {
          shiftId: shift.id,
          staffId: shift.staffId,
          changeType: "UPDATE",
          before: JSON.parse(JSON.stringify(shift)),
          after: JSON.parse(JSON.stringify(updated)),
        },
      });
      await tx.shiftChangeRequest.update({
        where: { id },
        data: { status: "APPROVED", reviewerName, reviewedAt: now },
      });
    });
  }

  revalidatePath("/admin/attendance-requests");
  revalidatePath("/admin/shifts");
}

export async function rejectShiftChangeRequest(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const reviewerName = String(formData.get("reviewerName") || "").trim();
  const rejectionReason = String(formData.get("rejectionReason") || "").trim();
  if (!reviewerName) throw new Error("承認者名は必須です");
  if (!rejectionReason) throw new Error("却下理由は必須です");

  const request = await prisma.shiftChangeRequest.findUnique({ where: { id } });
  if (!request) throw new Error("申請が見つかりません");
  if (request.status !== "PENDING") throw new Error("この申請はすでに処理済みです");

  await prisma.shiftChangeRequest.update({
    where: { id },
    data: { status: "REJECTED", reviewerName, reviewedAt: new Date(), rejectionReason },
  });

  revalidatePath("/admin/attendance-requests");
}
