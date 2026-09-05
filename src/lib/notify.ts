import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { formatJst, formatJstDate } from "@/lib/time";
import { WORK_TYPE_LABEL } from "@/lib/carriers";
import { IRREGULAR_REPORT_TYPE_LABEL, SHIFT_CHANGE_KIND_LABEL } from "@/lib/attendance-requests";
import type { Shift, Staff, IrregularReport, ShiftChangeRequest } from "@prisma/client";

// 通知の失敗(DB読み取りエラー等も含む)で、呼び出し元のシフト登録・変更・削除
// そのものを失敗させないよう、ここで例外を握りつぶす。
export async function notifyAdminsOfShiftChange(
  shifts: Shift[],
  staff: Staff,
  changeType: "CREATE" | "UPDATE" | "DELETE"
) {
  try {
    if (shifts.length === 0) return;
    const admins = await prisma.adminEmail.findMany();
    if (admins.length === 0) return;

    const actionLabel = { CREATE: "登録", UPDATE: "変更", DELETE: "削除" }[changeType];
    const subject = `【勤怠管理】シフト${actionLabel}: ${staff.name}`;
    const lines = [
      `${staff.name} さん(社員コード: ${staff.employeeCode})のシフトが${actionLabel}されました。`,
      "",
      ...shifts.map(
        (s) =>
          `・${formatJst(s.startTime)} 〜 ${formatJst(s.endTime)} / ${
            WORK_TYPE_LABEL[s.workType]
          } / ${s.carrier} / ${s.storeName}`
      ),
    ];

    await sendMail({ to: admins.map((a) => a.email), subject, text: lines.join("\n") });
  } catch (err) {
    console.error("Failed to notify admins of shift change", { changeType, err });
  }
}

export async function notifyAdminsOfIrregularReport(report: IrregularReport, staff: Staff) {
  try {
    const admins = await prisma.adminEmail.findMany();
    if (admins.length === 0) return;

    const subject = `【勤怠管理】イレギュラー報告: ${staff.name}`;
    const lines = [
      `${staff.name} さん(社員コード: ${staff.employeeCode})からイレギュラー報告がありました。`,
      "",
      `対象日: ${formatJstDate(report.targetDate)}`,
      `報告種類: ${IRREGULAR_REPORT_TYPE_LABEL[report.reportType]}`,
      `理由: ${report.reason}`,
      `詳細: ${report.details}`,
      ...(report.changedTime ? [`変更後の予定時間: ${report.changedTime}`] : []),
      ...(report.changedLocation ? [`変更後の勤務場所: ${report.changedLocation}`] : []),
      "",
      "管理画面「申請・報告管理」から確認してください。",
    ];

    await sendMail({ to: admins.map((a) => a.email), subject, text: lines.join("\n") });
  } catch (err) {
    console.error("Failed to notify admins of irregular report", { err });
  }
}

export async function notifyAdminsOfShiftChangeRequest(request: ShiftChangeRequest, staff: Staff) {
  try {
    const admins = await prisma.adminEmail.findMany();
    if (admins.length === 0) return;

    const subject = `【勤怠管理】シフト変更申請: ${staff.name}`;
    const lines = [
      `${staff.name} さん(社員コード: ${staff.employeeCode})からシフト変更申請がありました。`,
      "",
      `変更対象日: ${formatJstDate(request.targetDate)}`,
      `変更内容: ${SHIFT_CHANGE_KIND_LABEL[request.kind]}`,
      `理由: ${request.reason}`,
      "",
      "管理画面「申請・報告管理」から確認・承認してください。",
    ];

    await sendMail({ to: admins.map((a) => a.email), subject, text: lines.join("\n") });
  } catch (err) {
    console.error("Failed to notify admins of shift change request", { err });
  }
}
