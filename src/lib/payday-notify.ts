import { prisma } from "@/lib/prisma";
import { getLineToken, sendLinePush } from "@/lib/line";
import { computeMonthlyEarnings } from "@/lib/earnings";
import { fixedPaymentDueToday } from "@/lib/payment";
import { sumSubmittedExpenses } from "@/lib/staff-month-summary";
import { paydayMessage, type PaydayItem } from "@/lib/payday-message";
import { TRANSFER_NOTIFY_EMPLOYEE_CODE } from "@/lib/transfer-request-notify";
import { formatJstDate, jstDayRange, toJstDateValue, toJstTimeValue } from "@/lib/time";

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
  const { start, end } = jstDayRange(now);
  const items: PaydayItem[] = [];

  const fixedStaff = await prisma.staff.findMany({
    where: { status: "ACTIVE", paymentMethod: "FIXED" },
    select: { id: true, name: true, fixedClosingDay: true, fixedPaymentMonthOffset: true, fixedPaymentDay: true },
    orderBy: { employeeCode: "asc" },
  });
  for (const s of fixedStaff) {
    const due = fixedPaymentDueToday(s, now);
    if (!due) continue;
    const [, m] = due.closingYearMonth.split("-").map(Number);
    if (!due.monthEndClosing) {
      items.push({ kind: "FIXED", name: s.name, amount: null, note: "締日が月末以外のため金額は未計算" });
      continue;
    }
    const { confirmedAmount } = await computeMonthlyEarnings(s.id, due.closingYearMonth, now);
    // 振込金額 = 受取金額 + 申請のある経費(申請中・承認済)。
    const expenses = await sumSubmittedExpenses(s.id, due.closingYearMonth);
    items.push({
      kind: "FIXED",
      name: s.name,
      amount: confirmedAmount === null ? null : confirmedAmount + expenses,
      note: `${m}月分${expenses > 0 ? `・経費¥${expenses.toLocaleString("ja-JP")}込み` : ""}`,
    });
  }

  const requests = await prisma.transferRequest.findMany({
    where: { status: "REQUESTING", desiredPaymentDate: { gte: start, lt: end } },
    include: { staff: { select: { name: true } } },
    orderBy: { requestedAt: "asc" },
  });
  for (const r of requests) items.push({ kind: "REQUEST", name: r.staff.name, amount: r.amount });

  if (!items.length) return "none";
  const ok = await sendLinePush(target.lineGroupId, paydayMessage(formatJstDate(now), items, PAYMENTS_URL), `payday:${dateKey}`);
  return ok ? "sent" : "failed";
}
