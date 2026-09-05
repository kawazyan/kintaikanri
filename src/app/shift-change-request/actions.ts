"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStaffId } from "@/lib/auth";
import { combineJstDateAndTime, jstDayRange } from "@/lib/time";
import { notifyAdminsOfShiftChangeRequest } from "@/lib/notify";
import { SHIFT_CHANGE_KIND_LABEL } from "@/lib/attendance-requests";
import type { ShiftChangeKind } from "@prisma/client";

export type ShiftChangeRequestInput = {
  targetDate: string; // "YYYY-MM-DD" (対象シフトの日付)
  kind: ShiftChangeKind;
  reason: string;
  newDate: string; // DATE_CHANGE用 "YYYY-MM-DD"
  newStartTime: string; // TIME_CHANGE用 "HH:mm"
  newEndTime: string; // TIME_CHANGE用 "HH:mm"
  newLocation: string; // LOCATION_CHANGE用
  transferDate: string; // TRANSFER用 "YYYY-MM-DD"
  approvalConfirmed: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export async function submitShiftChangeRequest(
  input: ShiftChangeRequestInput
): Promise<{ error: string } | { ok: true }> {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  if (!DATE_RE.test(input.targetDate)) return { error: "変更対象日を選択してください" };
  if (!(input.kind in SHIFT_CHANGE_KIND_LABEL)) return { error: "変更希望内容を選択してください" };
  const reason = input.reason.trim();
  if (!reason) return { error: "変更理由を入力してください" };

  // クライアント側のチェックだけに頼らず、サーバー側でも同意チェックを必須とする。
  if (!input.approvalConfirmed) {
    return { error: "関係者への確認・承認を行ったうえでのみ申請できます" };
  }

  if (input.kind === "DATE_CHANGE" && !DATE_RE.test(input.newDate)) {
    return { error: "変更後の勤務日を選択してください" };
  }
  if (input.kind === "TIME_CHANGE" && (!TIME_RE.test(input.newStartTime) || !TIME_RE.test(input.newEndTime))) {
    return { error: "変更後の勤務時間を入力してください" };
  }
  if (input.kind === "LOCATION_CHANGE" && !input.newLocation.trim()) {
    return { error: "変更後の勤務場所を入力してください" };
  }
  if (input.kind === "TRANSFER" && !DATE_RE.test(input.transferDate)) {
    return { error: "振替日を選択してください" };
  }

  const { start, end } = jstDayRange(combineJstDateAndTime(input.targetDate, "00:00"));
  const shift = await prisma.shift.findFirst({
    where: { staffId, cancelledAt: null, startTime: { gte: start, lt: end } },
    orderBy: { startTime: "asc" },
  });
  if (!shift) return { error: "対象日にシフトが見つかりません" };

  const request = await prisma.shiftChangeRequest.create({
    data: {
      staffId,
      shiftId: shift.id,
      targetDate: start,
      kind: input.kind,
      reason,
      newDate: input.kind === "DATE_CHANGE" ? combineJstDateAndTime(input.newDate, "00:00") : null,
      newStartTime: input.kind === "TIME_CHANGE" ? input.newStartTime : null,
      newEndTime: input.kind === "TIME_CHANGE" ? input.newEndTime : null,
      newLocation: input.kind === "LOCATION_CHANGE" ? input.newLocation.trim() : null,
      transferDate: input.kind === "TRANSFER" ? combineJstDateAndTime(input.transferDate, "00:00") : null,
      approvalConfirmed: true,
    },
  });

  await notifyAdminsOfShiftChangeRequest(request, staff);

  revalidatePath("/shift-change-request");
  return { ok: true };
}
