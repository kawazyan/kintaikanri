"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fromJstInputValue, jstDayRange } from "@/lib/time";

export async function deleteClockRecord(id: string, formData: FormData) {
  await requireAdmin();
  const operatorName = String(formData.get("operatorName") ?? "").trim() || null;

  const existing = await prisma.clockRecord.findUnique({ where: { id } });
  if (!existing) return;

  await prisma.clockRecordHistory.create({
    data: {
      clockRecordId: existing.id,
      staffId: existing.staffId,
      changeType: "DELETE",
      before: JSON.parse(JSON.stringify(existing)),
      operatorName,
    },
  });

  await prisma.clockRecord.delete({ where: { id } });
  revalidatePath("/admin/records");
}

// スタッフが出退勤の打刻を押し忘れた場合などに、管理者が代わりに打刻記録を
// 作成する。当日のシフトがあれば clockAction と同様の方法で自動的に紐付ける。
export async function createClockRecordByAdmin(formData: FormData) {
  await requireAdmin();

  const staffId = String(formData.get("staffId") ?? "");
  const type = String(formData.get("type") ?? "IN") as "IN" | "OUT";
  const timestampRaw = String(formData.get("timestamp") ?? "");
  const storeNameInput = String(formData.get("storeName") ?? "").trim() || null;
  const operatorName = String(formData.get("operatorName") ?? "").trim() || null;

  if (!staffId || !timestampRaw) return;

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) return;

  const timestamp = fromJstInputValue(timestampRaw);

  const { start, end } = jstDayRange(timestamp);
  const todaysShifts = await prisma.shift.findMany({
    where: { staffId, cancelledAt: null, startTime: { gte: start, lt: end } },
    orderBy: { startTime: "asc" },
  });

  let matchedShift = null as (typeof todaysShifts)[number] | null;
  if (type === "IN") {
    for (const shift of todaysShifts) {
      const existingIn = await prisma.clockRecord.findFirst({
        where: { shiftId: shift.id, type: "IN" },
      });
      if (!existingIn) {
        matchedShift = shift;
        break;
      }
    }
    if (!matchedShift && todaysShifts.length > 0) {
      matchedShift = todaysShifts[todaysShifts.length - 1];
    }
  } else {
    const lastOpenIn = await prisma.clockRecord.findFirst({
      where: { staffId, type: "IN", timestamp: { gte: start, lt: end } },
      orderBy: { timestamp: "desc" },
    });
    if (lastOpenIn?.shiftId) {
      matchedShift =
        todaysShifts.find((s) => s.id === lastOpenIn.shiftId) ??
        (await prisma.shift.findUnique({ where: { id: lastOpenIn.shiftId } }));
    } else if (todaysShifts.length > 0) {
      matchedShift = todaysShifts[todaysShifts.length - 1];
    }
  }

  const created = await prisma.clockRecord.create({
    data: {
      staffId,
      type,
      timestamp,
      storeName: storeNameInput ?? matchedShift?.storeName ?? null,
      shiftId: matchedShift?.id,
      editedByAdmin: true,
    },
  });

  await prisma.clockRecordHistory.create({
    data: {
      clockRecordId: created.id,
      staffId,
      changeType: "CREATE",
      after: JSON.parse(JSON.stringify(created)),
      operatorName,
    },
  });

  revalidatePath("/admin/records");
  revalidatePath("/clock");
  redirect("/admin/records");
}

export async function updateClockRecord(id: string, formData: FormData) {
  await requireAdmin();
  const type = String(formData.get("type") ?? "IN") as "IN" | "OUT";
  const timestampRaw = String(formData.get("timestamp") ?? "");
  const storeName = String(formData.get("storeName") ?? "").trim() || null;
  const operatorName = String(formData.get("operatorName") ?? "").trim() || null;
  if (!timestampRaw) return;

  const existing = await prisma.clockRecord.findUnique({ where: { id } });
  if (!existing) return;

  const updated = await prisma.clockRecord.update({
    where: { id },
    data: {
      type,
      timestamp: fromJstInputValue(timestampRaw),
      storeName,
      editedByAdmin: true,
    },
  });

  await prisma.clockRecordHistory.create({
    data: {
      clockRecordId: updated.id,
      staffId: updated.staffId,
      changeType: "UPDATE",
      before: JSON.parse(JSON.stringify(existing)),
      after: JSON.parse(JSON.stringify(updated)),
      operatorName,
    },
  });

  revalidatePath("/admin/records");
  redirect("/admin/records");
}
