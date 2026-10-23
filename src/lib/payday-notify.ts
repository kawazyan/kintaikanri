import { prisma } from "@/lib/prisma";
import { getLineToken, sendLinePush } from "@/lib/line";
import { collectPaydayItems } from "@/lib/payday-items";
import { paydayMessage } from "@/lib/payday-message";
import { TRANSFER_NOTIFY_EMPLOYEE_CODE } from "@/lib/transfer-request-notify";
import { formatJstDate, toJstDateValue, toJstTimeValue } from "@/lib/time";

// 振込日(支払日)の朝に、その日に支払うスタッフを1通のLINEにまとめて知らせる(送り先: 振込申請の通知と同じグループ)。
// 対象: ①固定支払のスタッフで、支払日が今日 ②申請支払のスタッフの、希望振込日が今日で未振込の申請。

const PAYMENTS_URL = "https://kintaikanri-2.vercel.app/admin/payments?status=REQUESTING";

// 朝9時台だけ動く(cronは毎分呼ばれる)。二重送信は、LINEの再試行キー(同じ日付なら同じキー)で防ぐ。
export async function sendPaydayNotice(now: Date): Promise<"skipped" | "none" | "sent" | "failed"> {
  const time = toJstTimeValue(now);
  if (!(time >= "09:00" && time < "10:00")) return "skipped";
  if (!getLineToken("default")) return "skipped";

  const target = await prisma.staff.findFirst({ where: { employeeCode: TRANSFER_NOTIFY_EMPLOYEE_CODE }, select: { lineGroupId: true } });
  if (!target?.lineGroupId) return "skipped";

  const dateKey = toJstDateValue(now);
  const items = await collectPaydayItems(now);

  if (!items.length) return "none";
  const ok = await sendLinePush(target.lineGroupId, paydayMessage(formatJstDate(now), items, PAYMENTS_URL), `payday:${dateKey}`);
  return ok ? "sent" : "failed";
}
