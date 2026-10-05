"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { combineJstDateAndTime } from "@/lib/time";
import { findClockDuplicateError } from "@/lib/clock-duplicate";

export async function adminUpdateShift(shiftId: string, formData: FormData) {
  await requireAdmin();

  const workType = String(formData.get("workType") ?? "");
  const carrier = String(formData.get("carrier") ?? "").trim();
  const storeName = String(formData.get("storeName") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const startTimeStr = String(formData.get("startTime") ?? "");
  const endTimeStr = String(formData.get("endTime") ?? "");
  const unitAmountRaw = String(formData.get("unitAmount") ?? "").trim();

  if (
    (workType !== "BAND" && workType !== "SPOT") ||
    !carrier ||
    !storeName ||
    !date ||
    !startTimeStr ||
    !endTimeStr
  ) {
    return;
  }
  if (unitAmountRaw && (!/^\d+$/.test(unitAmountRaw))) return;

  const existing = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!existing) return;

  const startTime = combineJstDateAndTime(date, startTimeStr);
  let endTime = combineJstDateAndTime(date, endTimeStr);
  if (endTime <= startTime) {
    endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
  }

  const unitAmount = workType === "SPOT" && unitAmountRaw ? Number(unitAmountRaw) : null;

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: { workType, carrier, storeName, startTime, endTime, unitAmount },
  });

  await prisma.shiftHistory.create({
    data: {
      shiftId: updated.id,
      staffId: updated.staffId,
      changeType: "UPDATE",
      before: JSON.parse(JSON.stringify(existing)),
      after: JSON.parse(JSON.stringify(updated)),
    },
  });

  revalidatePath("/admin/shifts");
  redirect("/admin/shifts");
}

export async function adminDeleteShift(shiftId: string) {
  await requireAdmin();

  const existing = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!existing) return;

  await prisma.shiftHistory.create({
    data: {
      shiftId: existing.id,
      staffId: existing.staffId,
      changeType: "DELETE",
      before: JSON.parse(JSON.stringify(existing)),
      after: JSON.parse(JSON.stringify(existing)),
    },
  });

  await prisma.shift.delete({ where: { id: shiftId } });
  revalidatePath("/admin/shifts");
}

// 案件終了・稼働キャンセル等でシフトが cancelledAt 付きになっていると、
// 打刻自体はシフトに紐付いていても勤務スタンプ・確定受取金額の集計から
// 完全に除外される(game.ts / earnings.ts はどちらも cancelledAt: null の
// シフトしか見ない)。誤ってキャンセルされた場合の取り消し手段がなかった
// ため追加する。
export async function adminRestoreShift(shiftId: string) {
  await requireAdmin();

  const existing = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!existing || !existing.cancelledAt) return;

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: { cancelledAt: null, cancellationReason: null, cancelledBy: null },
  });

  await prisma.shiftHistory.create({
    data: {
      shiftId: updated.id,
      staffId: updated.staffId,
      changeType: "UPDATE",
      before: JSON.parse(JSON.stringify(existing)),
      after: JSON.parse(JSON.stringify(updated)),
    },
  });

  revalidatePath("/admin/shifts");
  revalidatePath("/admin/records");
}

export async function adminBulkDeleteShifts(shiftIds: string[]) {
  await requireAdmin();
  if (!shiftIds.length) return { ok: true as const, deleted: 0 };

  const existing = await prisma.shift.findMany({ where: { id: { in: shiftIds } } });
  if (!existing.length) return { ok: true as const, deleted: 0 };

  await prisma.$transaction([
    prisma.shiftHistory.createMany({
      data: existing.map((e) => ({
        shiftId: e.id,
        staffId: e.staffId,
        changeType: "DELETE",
        before: JSON.parse(JSON.stringify(e)),
        after: JSON.parse(JSON.stringify(e)),
      })),
    }),
    prisma.shift.deleteMany({ where: { id: { in: existing.map((e) => e.id) } } }),
  ]);

  revalidatePath("/admin/shifts");
  return { ok: true as const, deleted: existing.length };
}

export type RegisterClockByShiftResult =
  | { ok: true; created: ("IN" | "OUT")[] }
  | { ok: false; error: string };

// 管理画面からの代理打刻(シフト通り)。出勤・退勤のどちらか、または両方の
// 打刻が漏れているシフトに、シフトの開始時刻で出勤、終了時刻で退勤の打刻を
// 1回の操作で登録する。すでにある打刻は触らず、無いほうだけを追加する。
// 手動の代理打刻と同じく editedByAdmin: true で登録するため、皆勤判定
// (game.ts)の対象外になる仕様は変わらない。
export async function adminRegisterClockByShift(shiftId: string): Promise<RegisterClockByShiftResult> {
  await requireAdmin();

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) return { ok: false, error: "シフトが見つかりません。" };
  if (shift.cancelledAt) return { ok: false, error: "キャンセル済みのシフトには打刻を登録できません。" };
  // まだ終わっていないシフトに退勤時刻(未来)の打刻を入れないための制限。
  if (shift.endTime > new Date()) {
    return { ok: false, error: "このシフトはまだ終了していません。終了後に登録してください。" };
  }

  const existing = await prisma.clockRecord.findMany({
    where: { shiftId: shift.id },
    select: { type: true },
  });
  const hasIn = existing.some((r) => r.type === "IN");
  const hasOut = existing.some((r) => r.type === "OUT");
  if (hasIn && hasOut) return { ok: false, error: "このシフトには出勤・退勤の打刻がすでにあります。" };

  const targets: { type: "IN" | "OUT"; timestamp: Date }[] = [];
  if (!hasIn) targets.push({ type: "IN", timestamp: shift.startTime });
  if (!hasOut) targets.push({ type: "OUT", timestamp: shift.endTime });

  // 重複チェック(通常の代理打刻と同じ判定)。画面表示後に他の操作で打刻が
  // 追加されていた場合に二重登録しないための最終確認。
  for (const t of targets) {
    const duplicateError = await findClockDuplicateError({
      staffId: shift.staffId,
      type: t.type,
      shiftId: shift.id,
      timestamp: t.timestamp,
    });
    if (duplicateError) return { ok: false, error: duplicateError };
  }

  // 出勤と退勤は、片方だけ登録された状態で止まらないよう1トランザクションで作る。
  await prisma.$transaction(async (tx) => {
    for (const t of targets) {
      const created = await tx.clockRecord.create({
        data: {
          staffId: shift.staffId,
          type: t.type,
          timestamp: t.timestamp,
          storeName: shift.storeName,
          shiftId: shift.id,
          editedByAdmin: true,
        },
      });
      await tx.clockRecordHistory.create({
        data: {
          clockRecordId: created.id,
          staffId: shift.staffId,
          changeType: "CREATE",
          after: JSON.parse(JSON.stringify(created)),
          operatorName: null,
        },
      });
    }
  });

  revalidatePath("/admin/shifts");
  revalidatePath("/admin/records");
  revalidatePath("/clock");
  revalidatePath("/titles");
  return { ok: true, created: targets.map((t) => t.type) };
}
