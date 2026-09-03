import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { formatJst } from "@/lib/time";
import { WORK_TYPE_LABEL } from "@/lib/carriers";
import type { Shift, Staff } from "@prisma/client";

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
