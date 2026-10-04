import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { currentJstYearMonth, jstMonthRange, toJstDateValue, toJstTimeValue } from "@/lib/time";

// 取引先向け「出退勤の閲覧専用ページ」用のデータ。
// 位置情報(座標)などは返さない。見せるのは、スタッフ名・店舗・予定・出勤/退勤時刻・状態だけ。

export type ViewStatus = "出勤前" | "未出勤" | "出勤中" | "退勤済み" | "退勤未打刻" | "欠勤" | "キャンセル";

export type ViewRow = {
  id: string;
  date: string; // YYYY-MM-DD(JST)
  staffName: string;
  storeName: string;
  plan: string; // 予定 "09:30–18:30"
  clockIn: string | null; // "09:58"
  clockOut: string | null;
  status: ViewStatus;
  notes: string[]; // スタッフが申告した「遅刻」「早退」(申告があった日だけ。理由などは出さない)
};

export const newViewToken = () => randomBytes(24).toString("base64url");

export async function findActiveViewToken(token: string) {
  if (!token || token.length < 20) return null;
  const row = await prisma.clientViewToken.findUnique({ where: { token }, include: { client: { select: { id: true, name: true } } } });
  return row?.active ? row : null;
}

export function normalizeYearMonth(raw: string | undefined) {
  return raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : currentJstYearMonth();
}

export async function loadClientAttendance(clientId: string, yearMonth: string, now: Date = new Date()): Promise<ViewRow[]> {
  const { start, end } = jstMonthRange(yearMonth);
  const shifts = await prisma.shift.findMany({
    where: { startTime: { gte: start, lt: end }, workOrderStaff: { workOrder: { clientId } } },
    include: { staff: { select: { name: true } }, clockRecords: { orderBy: { timestamp: "asc" } } },
    orderBy: [{ startTime: "asc" }, { staffId: "asc" }],
  });
  // 遅刻・早退・欠勤は、スタッフがアプリで申告したものだけを表示する(理由・詳細は取引先に出さない)。
  const reports = shifts.length
    ? await prisma.irregularReport.findMany({
        where: {
          staffId: { in: [...new Set(shifts.map((s) => s.staffId))] },
          targetDate: { gte: start, lt: end },
          reportType: { in: ["LATE", "EARLY_LEAVE", "ABSENCE", "SAME_DAY_ABSENCE"] },
        },
        select: { staffId: true, targetDate: true, reportType: true },
      })
    : [];
  const reported = new Map<string, Set<string>>();
  for (const r of reports) {
    const key = `${r.staffId}|${toJstDateValue(r.targetDate)}`;
    (reported.get(key) ?? reported.set(key, new Set()).get(key)!).add(r.reportType);
  }

  return shifts.map((s) => {
    const kinds = reported.get(`${s.staffId}|${toJstDateValue(s.startTime)}`);
    const absent = !!kinds && (kinds.has("ABSENCE") || kinds.has("SAME_DAY_ABSENCE"));
    const inn = s.clockRecords.find((r) => r.type === "IN");
    const out = [...s.clockRecords].reverse().find((r) => r.type === "OUT");
    const status: ViewStatus = s.cancelledAt
      ? "キャンセル"
      : absent && !inn
        ? "欠勤"
        : inn && out
        ? "退勤済み"
        : inn
          ? toJstDateValue(s.startTime) < toJstDateValue(now)
            ? "退勤未打刻" // 過去の日で退勤の打刻がない
            : "出勤中"
          : now > s.startTime
            ? "未出勤"
            : "出勤前";
    return {
      id: s.id,
      date: toJstDateValue(s.startTime),
      staffName: s.staff.name,
      storeName: s.storeName,
      plan: `${toJstTimeValue(s.startTime)}–${toJstTimeValue(s.endTime)}`,
      clockIn: inn ? toJstTimeValue(inn.timestamp) : null,
      clockOut: out ? toJstTimeValue(out.timestamp) : null,
      status,
      notes: [...(kinds?.has("LATE") ? ["遅刻"] : []), ...(kinds?.has("EARLY_LEAVE") ? ["早退"] : [])],
    };
  });
}
