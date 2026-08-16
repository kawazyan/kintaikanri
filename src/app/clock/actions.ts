"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStaffId } from "@/lib/auth";
import { jstDayRange } from "@/lib/time";

type ClockResult =
  | { ok: true; storeName: string | null; warning: string | null }
  | { ok: false; error: string };

export async function clockAction(
  type: "IN" | "OUT",
  latitude: number | null,
  longitude: number | null
): Promise<ClockResult> {
  const staffId = await getStaffId();
  if (!staffId) {
    return { ok: false, error: "本人確認が切れています。最初からやり直してください。" };
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") {
    return { ok: false, error: "スタッフ情報が見つかりません" };
  }

  const { start, end } = jstDayRange();
  const todaysShifts = await prisma.shift.findMany({
    where: { staffId, startTime: { gte: start, lt: end } },
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
      where: {
        staffId,
        type: "IN",
        timestamp: { gte: start, lt: end },
      },
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

  await prisma.clockRecord.create({
    data: {
      staffId,
      type,
      timestamp: new Date(),
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      storeName: matchedShift?.storeName,
      shiftId: matchedShift?.id,
    },
  });

  revalidatePath("/clock");
  return {
    ok: true,
    storeName: matchedShift?.storeName ?? null,
    warning: matchedShift ? null : "本日のシフトが登録されていません",
  };
}
