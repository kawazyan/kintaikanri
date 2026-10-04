import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { currentJstYearMonth, jstMonthRange, toJstDateValue, toJstTimeValue } from "@/lib/time";
import { SHIFT_CHANGE_KIND_LABEL, SHIFT_CHANGE_STATUS_LABEL } from "@/lib/attendance-requests";

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
  notes: { label: string; reason: string }[]; // スタッフが申告した「遅刻」「早退」と、その理由(申告があった日だけ)
};

// スタッフ側のシフト変更の履歴(申請・変更・削除)。取引先の案件のシフトに関するものだけ。
export type ChangeEntry = {
  id: string;
  at: Date; // 申請・変更した日時
  staffName: string;
  title: string; // 例: 勤務日変更
  detail: string; // 例: 9/30(火) → 9/29(月)
  reason: string | null;
  result: string | null; // 例: 承認 / 申請中 / 却下
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
        select: { staffId: true, targetDate: true, reportType: true, reason: true },
      })
    : [];
  const reported = new Map<string, Map<string, string>>(); // 種別 → 理由
  for (const r of reports) {
    const key = `${r.staffId}|${toJstDateValue(r.targetDate)}`;
    (reported.get(key) ?? reported.set(key, new Map()).get(key)!).set(r.reportType, r.reason);
  }

  return shifts.map((s) => {
    const kinds = reported.get(`${s.staffId}|${toJstDateValue(s.startTime)}`);
    const absentReason = kinds?.get("ABSENCE") ?? kinds?.get("SAME_DAY_ABSENCE");
    const absent = absentReason !== undefined;
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
      notes: [
        ...(absent && !inn ? [{ label: "欠勤", reason: absentReason ?? "" }] : []),
        ...(kinds?.has("LATE") ? [{ label: "遅刻", reason: kinds.get("LATE") ?? "" }] : []),
        ...(kinds?.has("EARLY_LEAVE") ? [{ label: "早退", reason: kinds.get("EARLY_LEAVE") ?? "" }] : []),
      ],
    };
  });
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const dayText = (dateKey: string) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${m}/${d}(${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
};
const isoText = (iso: unknown) => {
  const d = typeof iso === "string" ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
type ShiftSnap = { startTime?: unknown; endTime?: unknown; storeName?: unknown };
function snapText(v: ShiftSnap) {
  const st = isoText(v.startTime);
  const en = isoText(v.endTime);
  const parts: string[] = [];
  if (st) parts.push(dayText(toJstDateValue(st)));
  if (st && en) parts.push(`${toJstTimeValue(st)}–${toJstTimeValue(en)}`);
  if (typeof v.storeName === "string" && v.storeName) parts.push(v.storeName);
  return parts.join(" ");
}

// その月のシフトに関する、スタッフ側の変更履歴(シフト変更申請 + シフトの変更・削除)を新しい順で返す。
export async function loadClientShiftChanges(clientId: string, yearMonth: string): Promise<ChangeEntry[]> {
  const { start, end } = jstMonthRange(yearMonth);
  const assignments = await prisma.workOrderStaff.findMany({ where: { workOrder: { clientId } }, select: { id: true, staffId: true } });
  const assignmentIds = new Set(assignments.map((a) => a.id));
  const shifts = await prisma.shift.findMany({
    where: { startTime: { gte: start, lt: end }, workOrderStaffId: { in: [...assignmentIds] } },
    select: { id: true, staffId: true, startTime: true },
  });
  const shiftIds = shifts.map((s) => s.id);
  const staffDates = new Set(shifts.map((s) => `${s.staffId}|${toJstDateValue(s.startTime)}`));
  const staffIds = [...new Set(assignments.map((a) => a.staffId).filter((x): x is string => !!x))];
  if (!staffIds.length) return [];

  const names = new Map((await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })).map((x) => [x.id, x.name]));
  const entries: ChangeEntry[] = [];

  // 1) シフト変更申請(理由つき)。この取引先のシフトに紐づくもの、または同じスタッフ・同じ日付のもの。
  const requests = await prisma.shiftChangeRequest.findMany({
    where: { staffId: { in: staffIds }, OR: [{ targetDate: { gte: start, lt: end } }, { newDate: { gte: start, lt: end } }] },
    orderBy: { createdAt: "desc" },
  });
  for (const r of requests) {
    const mine =
      (r.shiftId && shiftIds.includes(r.shiftId)) ||
      staffDates.has(`${r.staffId}|${toJstDateValue(r.targetDate)}`) ||
      (r.newDate && staffDates.has(`${r.staffId}|${toJstDateValue(r.newDate)}`));
    if (!mine) continue;
    const from = dayText(toJstDateValue(r.targetDate));
    const detail =
      r.kind === "DATE_CHANGE" ? `${from} → ${r.newDate ? dayText(toJstDateValue(r.newDate)) : "(日付未設定)"}`
      : r.kind === "TIME_CHANGE" ? `${from} の勤務時間 → ${r.newStartTime ?? "?"}–${r.newEndTime ?? "?"}`
      : r.kind === "LOCATION_CHANGE" ? `${from} の勤務場所 → ${r.newLocation ?? "(未設定)"}`
      : r.kind === "TO_OFF" ? `${from} を休みへ変更`
      : `${from} → ${r.transferDate ? dayText(toJstDateValue(r.transferDate)) : "(日付未設定)"} へ振替`;
    entries.push({
      id: `req-${r.id}`,
      at: r.createdAt,
      staffName: names.get(r.staffId) ?? "",
      title: SHIFT_CHANGE_KIND_LABEL[r.kind],
      detail,
      reason: r.reason || null,
      result: SHIFT_CHANGE_STATUS_LABEL[r.status],
    });
  }

  // 2) シフト自体の変更・削除の履歴(変更前→変更後)。
  const histories = await prisma.shiftHistory.findMany({
    where: { staffId: { in: staffIds }, changeType: { in: ["UPDATE", "DELETE"] } },
    orderBy: { changedAt: "desc" },
  });
  for (const h of histories) {
    const before = (h.before ?? {}) as ShiftSnap & { workOrderStaffId?: string | null };
    const after = (h.after ?? {}) as ShiftSnap;
    const inMonth = (v: ShiftSnap) => {
      const st = isoText(v.startTime);
      return !!st && st >= start && st < end;
    };
    const mine =
      h.changeType === "DELETE"
        ? !!before.workOrderStaffId && assignmentIds.has(before.workOrderStaffId) && inMonth(before)
        : !!h.shiftId && shiftIds.includes(h.shiftId);
    if (!mine) continue;
    if (h.changeType === "UPDATE") {
      const a = snapText(before);
      const b = snapText(after);
      if (!a || !b || a === b) continue; // 見た目に変わりがない更新は載せない
      entries.push({ id: `his-${h.id}`, at: h.changedAt, staffName: names.get(h.staffId) ?? "", title: "シフト変更", detail: `${a} → ${b}`, reason: null, result: null });
    } else {
      entries.push({ id: `his-${h.id}`, at: h.changedAt, staffName: names.get(h.staffId) ?? "", title: "シフト削除", detail: snapText(before), reason: null, result: null });
    }
  }
  return entries.sort((x, y) => y.at.getTime() - x.at.getTime());
}
