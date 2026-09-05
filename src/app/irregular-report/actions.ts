"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStaffId } from "@/lib/auth";
import { combineJstDateAndTime } from "@/lib/time";
import { notifyAdminsOfIrregularReport } from "@/lib/notify";
import { IRREGULAR_REPORT_TYPE_LABEL } from "@/lib/attendance-requests";
import type { IrregularReportType } from "@prisma/client";

export type IrregularReportInput = {
  targetDate: string; // "YYYY-MM-DD"
  reportType: IrregularReportType;
  reason: string;
  details: string;
  changedTime: string;
  changedLocation: string;
};

export async function submitIrregularReport(
  input: IrregularReportInput
): Promise<{ error: string } | { ok: true }> {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) return { error: "対象日を選択してください" };
  if (!(input.reportType in IRREGULAR_REPORT_TYPE_LABEL)) return { error: "報告種類を選択してください" };
  const reason = input.reason.trim();
  const details = input.details.trim();
  if (!reason) return { error: "理由を入力してください" };
  if (!details) return { error: "詳細を入力してください" };

  const report = await prisma.irregularReport.create({
    data: {
      staffId,
      targetDate: combineJstDateAndTime(input.targetDate, "00:00"),
      reportType: input.reportType,
      reason,
      details,
      changedTime: input.changedTime.trim() || null,
      changedLocation: input.changedLocation.trim() || null,
    },
  });

  await notifyAdminsOfIrregularReport(report, staff);

  revalidatePath("/irregular-report");
  return { ok: true };
}
