"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStaffId } from "@/lib/auth";
import { combineJstDateAndTime, jstMonthRange, toJstDateValue } from "@/lib/time";
import { notifyAdminsOfShiftChange } from "@/lib/notify";

export type BulkShiftInput = {
  yearMonth: string; // "YYYY-MM"
  workType: "BAND" | "SPOT";
  carrier: string;
  storeName: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  dates: string[]; // "YYYY-MM-DD"[]
  targetAmount: number | null; // BAND only, optional
  spotAmounts?: Record<string, number>; // SPOT only: dateKey -> per-shift unit amount
};

function validateCommonFields(input: {
  workType: string;
  carrier: string;
  storeName: string;
  startTime: string;
  endTime: string;
}): string | null {
  if (input.workType !== "BAND" && input.workType !== "SPOT") return "稼働区分が不正です";
  if (!input.carrier.trim()) return "キャリアを選択してください";
  if (!input.storeName.trim()) return "稼働先店舗名を入力してください";
  if (!/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime)) {
    return "稼働予定時間を選択してください";
  }
  return null;
}

function buildShiftTimes(dateStr: string, startTimeStr: string, endTimeStr: string) {
  const startTime = combineJstDateAndTime(dateStr, startTimeStr);
  let endTime = combineJstDateAndTime(dateStr, endTimeStr);
  if (endTime <= startTime) {
    endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
  }
  return { startTime, endTime };
}

export async function getMonthPlanningData(
  yearMonth: string
): Promise<{ existingDates: string[]; targetAmount: number | null }> {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const { start, end } = jstMonthRange(yearMonth);
  const [shifts, target] = await Promise.all([
    prisma.shift.findMany({
      where: { staffId, startTime: { gte: start, lt: end } },
      select: { startTime: true },
    }),
    prisma.monthlyEarningTarget.findUnique({
      where: { staffId_yearMonth: { staffId, yearMonth } },
    }),
  ]);

  return {
    existingDates: shifts.map((s) => toJstDateValue(s.startTime)),
    targetAmount: target?.targetAmount ?? null,
  };
}

export async function createShiftsBulk(
  input: BulkShiftInput
): Promise<{ error: string } | { ok: true; createdCount: number; skippedCount: number }> {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const fieldError = validateCommonFields(input);
  if (fieldError) return { error: fieldError };
  if (!/^\d{4}-\d{2}$/.test(input.yearMonth)) return { error: "対象月が不正です" };

  if (input.workType === "BAND") {
    if (
      input.targetAmount !== null &&
      (!Number.isInteger(input.targetAmount) || input.targetAmount < 0)
    ) {
      return { error: "月間受取予定単価を正しく入力してください" };
    }
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) redirect("/");

  const { start, end } = jstMonthRange(input.yearMonth);
  const existing = await prisma.shift.findMany({
    where: { staffId, startTime: { gte: start, lt: end } },
    select: { startTime: true },
  });
  const existingDateKeys = new Set(existing.map((s) => toJstDateValue(s.startTime)));

  const newDates = input.dates.filter((d) => !existingDateKeys.has(d));
  if (newDates.length === 0 && existingDateKeys.size === 0) {
    return { error: "稼働日を1つ以上選択してください" };
  }

  if (input.workType === "SPOT") {
    for (const dateStr of newDates) {
      const amount = input.spotAmounts?.[dateStr];
      if (!Number.isInteger(amount) || (amount as number) < 0) {
        return { error: `${dateStr} の単価を正しく入力してください` };
      }
    }
  }

  const storeName = input.storeName.trim();
  const carrier = input.carrier.trim();

  const created = await Promise.all(
    newDates.map((dateStr) => {
      const { startTime, endTime } = buildShiftTimes(dateStr, input.startTime, input.endTime);
      return prisma.shift.create({
        data: {
          staffId,
          workType: input.workType,
          carrier,
          storeName,
          startTime,
          endTime,
          unitAmount: input.workType === "SPOT" ? input.spotAmounts?.[dateStr] : null,
        },
      });
    })
  );

  if (created.length > 0) {
    await prisma.shiftHistory.createMany({
      data: created.map((shift) => ({
        shiftId: shift.id,
        staffId,
        changeType: "CREATE",
        after: JSON.parse(JSON.stringify(shift)),
      })),
    });
  }

  // Only BAND uses a monthly target; leave it untouched if left blank so an
  // existing value isn't silently cleared.
  if (input.workType === "BAND" && input.targetAmount !== null) {
    await prisma.monthlyEarningTarget.upsert({
      where: { staffId_yearMonth: { staffId, yearMonth: input.yearMonth } },
      update: { targetAmount: input.targetAmount },
      create: { staffId, yearMonth: input.yearMonth, targetAmount: input.targetAmount },
    });
  }

  if (created.length > 0) {
    await notifyAdminsOfShiftChange(created, staff, "CREATE");
  }

  revalidatePath("/shift");
  revalidatePath("/clock");
  return { ok: true, createdCount: created.length, skippedCount: input.dates.length - newDates.length };
}

type SingleShiftInput = {
  workType: "BAND" | "SPOT";
  carrier: string;
  storeName: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  unitAmount: number | null; // SPOT only
};

export async function updateShift(
  shiftId: string,
  input: SingleShiftInput
): Promise<{ error: string } | { ok: true }> {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const existing = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!existing || existing.staffId !== staffId) {
    return { error: "このシフトは編集できません" };
  }

  const fieldError = validateCommonFields(input);
  if (fieldError) return { error: fieldError };
  if (input.workType === "SPOT" && (!Number.isInteger(input.unitAmount) || (input.unitAmount as number) < 0)) {
    return { error: "単価を正しく入力してください" };
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) redirect("/");

  const { startTime, endTime } = buildShiftTimes(input.date, input.startTime, input.endTime);

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      workType: input.workType,
      carrier: input.carrier.trim(),
      storeName: input.storeName.trim(),
      startTime,
      endTime,
      unitAmount: input.workType === "SPOT" ? input.unitAmount : null,
    },
  });

  await prisma.shiftHistory.create({
    data: {
      shiftId: updated.id,
      staffId,
      changeType: "UPDATE",
      before: JSON.parse(JSON.stringify(existing)),
      after: JSON.parse(JSON.stringify(updated)),
    },
  });

  await notifyAdminsOfShiftChange([updated], staff, "UPDATE");

  revalidatePath("/shift");
  revalidatePath("/clock");
  return { ok: true };
}

export async function deleteShift(shiftId: string): Promise<{ error: string } | { ok: true }> {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const existing = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!existing || existing.staffId !== staffId) {
    return { error: "このシフトは削除できません" };
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) redirect("/");

  await prisma.shiftHistory.create({
    data: {
      shiftId: existing.id,
      staffId,
      changeType: "DELETE",
      before: JSON.parse(JSON.stringify(existing)),
      after: JSON.parse(JSON.stringify(existing)),
    },
  });

  await notifyAdminsOfShiftChange([existing], staff, "DELETE");

  await prisma.shift.delete({ where: { id: shiftId } });

  revalidatePath("/shift");
  revalidatePath("/clock");
  return { ok: true };
}
