"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { combineJstDateAndTime } from "@/lib/time";

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
