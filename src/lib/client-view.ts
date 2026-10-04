import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { currentJstYearMonth, jstMonthRange, toJstDateValue, toJstTimeValue } from "@/lib/time";

// 取引先向け「出退勤の閲覧専用ページ」用のデータ。
// 位置情報(座標)などは返さない。見せるのは、スタッフ名・店舗・予定・出勤/退勤時刻・状態だけ。

export type ViewStatus = "出勤前" | "未出勤" | "出勤中" | "退勤済み" | "キャンセル";

export type ViewRow = {
  id: string;
  date: string; // YYYY-MM-DD(JST)
  staffName: string;
  storeName: string;
  plan: string; // 予定 "09:30–18:30"
  clockIn: string | null; // "09:58"
  clockOut: string | null;
  status: ViewStatus;
  corrected: boolean; // 管理者が打刻を修正している
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
  return shifts.map((s) => {
    const inn = s.clockRecords.find((r) => r.type === "IN");
    const out = [...s.clockRecords].reverse().find((r) => r.type === "OUT");
    const status: ViewStatus = s.cancelledAt
      ? "キャンセル"
      : inn && out
        ? "退勤済み"
        : inn
          ? "出勤中"
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
      corrected: s.clockRecords.some((r) => r.editedByAdmin),
    };
  });
}
