"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStaffId } from "@/lib/auth";
import { toJstDateValue } from "@/lib/time";

type Result = { ok: true } | { ok: false; error: string };
type Kind = "ABSENT" | "LATE" | "EARLY_LEAVE";

async function requireSimpleStaff() {
  const staffId = await getStaffId();
  if (!staffId) return null;
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { id: true, status: true, simpleMode: true } });
  if (!staff || staff.status !== "ACTIVE" || !staff.simpleMode) return null;
  return staff;
}

// 簡易モードのスタッフが、本日の欠勤・遅刻・早退を記録する(同じ種類は1日1件)。
export async function recordSimpleAttendance(kind: Kind): Promise<Result> {
  if (kind !== "ABSENT" && kind !== "LATE" && kind !== "EARLY_LEAVE") return { ok: false, error: "不正な操作です" };
  const staff = await requireSimpleStaff();
  if (!staff) return { ok: false, error: "本人確認が切れています。最初からやり直してください。" };
  const date = toJstDateValue(new Date());
  await prisma.simpleAttendanceEntry.upsert({
    where: { staffId_date_kind: { staffId: staff.id, date, kind } },
    create: { staffId: staff.id, date, kind },
    update: {},
  });
  revalidatePath("/clock");
  return { ok: true };
}

// 押し間違いの取り消し(本人の、本日分のみ)。
export async function cancelSimpleAttendance(entryId: string): Promise<Result> {
  const staff = await requireSimpleStaff();
  if (!staff) return { ok: false, error: "本人確認が切れています。最初からやり直してください。" };
  const entry = await prisma.simpleAttendanceEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.staffId !== staff.id) return { ok: false, error: "記録が見つかりません" };
  if (entry.date !== toJstDateValue(new Date())) return { ok: false, error: "本日分のみ取り消せます。管理者に連絡してください。" };
  await prisma.simpleAttendanceEntry.delete({ where: { id: entryId } });
  revalidatePath("/clock");
  return { ok: true };
}
