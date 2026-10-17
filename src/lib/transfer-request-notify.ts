import { prisma } from "@/lib/prisma";
import { sendLinePush } from "@/lib/line";
import { formatJst, toJstDateValue } from "@/lib/time";

// 振込申請が来たときのLINE通知の送り先: この社員番号のスタッフの「出勤用LINEグループ」(管理画面のLINE連携で設定済みのもの)。
// 送り先を変えるときは、ここの社員番号を変える。
export const TRANSFER_NOTIFY_EMPLOYEE_CODE = "00001";

const ADMIN_PAYMENTS_URL = "https://kintaikanri-2.vercel.app/admin/payments?status=REQUESTING";

// 通知の文面(純粋な関数。テストできる)。
export function transferRequestMessage(p: { staffName: string; amount: number; desiredDate: string; requestedAt: Date }) {
  return [
    "【振込申請】",
    `${p.staffName.replace(/[\s　]+/g, " ")}さんから振込申請がありました。`,
    `申請額: ¥${p.amount.toLocaleString("ja-JP")}`,
    `希望振込日: ${p.desiredDate}`,
    `申請日時: ${formatJst(p.requestedAt)}`,
    "",
    `振込申請一覧: ${ADMIN_PAYMENTS_URL}`,
  ].join("\n");
}

// 申請の保存後に呼ぶ。通知は補助機能なので、LINE未設定・送信失敗・送り先未連携でも、申請そのものは失敗させない(例外を投げない)。
export async function notifyTransferRequest(requestId: string) {
  try {
    const req = await prisma.transferRequest.findUnique({ where: { id: requestId }, include: { staff: { select: { name: true } } } });
    if (!req) return;
    const target = await prisma.staff.findFirst({ where: { employeeCode: TRANSFER_NOTIFY_EMPLOYEE_CODE }, select: { lineGroupId: true } });
    if (!target?.lineGroupId) {
      console.error("transfer request notify: 送り先のLINEグループが未連携です", { employeeCode: TRANSFER_NOTIFY_EMPLOYEE_CODE });
      return;
    }
    await sendLinePush(
      target.lineGroupId,
      transferRequestMessage({ staffName: req.staff.name, amount: req.amount, desiredDate: toJstDateValue(req.desiredPaymentDate), requestedAt: req.requestedAt }),
      `transfer-request:${req.id}`,
    );
  } catch (e) {
    console.error("transfer request notify failed", e);
  }
}
