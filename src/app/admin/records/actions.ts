"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fromJstInputValue, jstDayRange } from "@/lib/time";
import { findClockDuplicateError } from "@/lib/clock-duplicate";

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
  revalidatePath("/clock");
  revalidatePath("/titles");
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

  const duplicateError = await findClockDuplicateError({
    staffId,
    type,
    shiftId: matchedShift?.id ?? null,
    timestamp,
  });
  if (duplicateError) {
    redirect(`/admin/records/new?staffId=${encodeURIComponent(staffId)}&error=${encodeURIComponent(duplicateError)}`);
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
  const shiftId = String(formData.get("shiftId") ?? "").trim() || null;
  if (!timestampRaw) return;

  const existing = await prisma.clockRecord.findUnique({ where: { id } });
  if (!existing) return;

  // shiftId は必ずこの打刻と同じスタッフのシフトでなければならない。
  // ここを素通りさせると、打刻はシフトに「紐付いている」のに、そのシフトが
  // 別のスタッフのものだと勤務スタンプ・確定受取金額の集計が本人に反映され
  // ない(紐付け先のスタッフ側に誤って計上されてしまう)事故になる。
  if (shiftId) {
    const targetShift = await prisma.shift.findUnique({ where: { id: shiftId }, select: { staffId: true } });
    if (!targetShift || targetShift.staffId !== existing.staffId) return;
  }

  const newTimestamp = fromJstInputValue(timestampRaw);
  const duplicateError = await findClockDuplicateError({
    staffId: existing.staffId,
    type,
    shiftId,
    timestamp: newTimestamp,
    excludeId: id,
  });
  if (duplicateError) {
    redirect(`/admin/records/${id}?error=${encodeURIComponent(duplicateError)}`);
  }

  const updated = await prisma.clockRecord.update({
    where: { id },
    data: {
      type,
      timestamp: newTimestamp,
      storeName,
      shiftId,
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
  revalidatePath("/clock");
  revalidatePath("/titles");
  redirect("/admin/records");
}

// 退勤打刻漏れを、シフトの終了時刻(定時)で一括承認する。
// チェックされた「出勤打刻」のIDを受け取り、サーバー側で毎回条件を再判定してから退勤を作る
// (画面の表示を信用しない)。作った退勤は editedByAdmin=true + 履歴(CREATE)で通常の打刻と区別できる。
export async function bulkApproveMissedClockOut(formData: FormData) {
  await requireAdmin();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const operatorName = String(formData.get("operatorName") ?? "").trim() || null;

  // 承認後に元の絞り込み条件へ戻す(既知のパラメータだけ引き継ぐ)
  const back = new URLSearchParams();
  for (const k of ["staffId", "month", "date", "unlinkedOnly"]) {
    const v = String(formData.get(k) ?? "");
    if (v) back.set(k, v);
  }

  const now = new Date();
  let approved = 0;
  const reasons = new Set<string>();
  let skipped = 0;
  const skip = (reason: string) => {
    skipped++;
    reasons.add(reason);
  };

  for (const id of ids) {
    const inRec = await prisma.clockRecord.findUnique({ where: { id }, include: { shift: true } });
    if (!inRec || inRec.type !== "IN") {
      skip("出勤打刻が見つからない");
      continue;
    }
    const shift = inRec.shift;
    if (!shift || shift.cancelledAt || shift.staffId !== inRec.staffId) {
      skip("シフト外・キャンセル済み・スタッフ不一致");
      continue;
    }
    if (now < shift.endTime) {
      skip("シフトがまだ終わっていない");
      continue;
    }
    if (inRec.timestamp >= shift.endTime) {
      skip("出勤打刻がシフト終了時刻より後");
      continue;
    }
    const duplicateError = await findClockDuplicateError({
      staffId: inRec.staffId,
      type: "OUT",
      shiftId: shift.id,
      timestamp: shift.endTime,
    });
    if (duplicateError) {
      skip("すでに退勤打刻がある");
      continue;
    }

    const created = await prisma.clockRecord.create({
      data: {
        staffId: inRec.staffId,
        type: "OUT",
        timestamp: shift.endTime,
        storeName: inRec.storeName ?? shift.storeName,
        shiftId: shift.id,
        editedByAdmin: true,
      },
    });
    await prisma.clockRecordHistory.create({
      data: {
        clockRecordId: created.id,
        staffId: inRec.staffId,
        changeType: "CREATE",
        after: { ...JSON.parse(JSON.stringify(created)), bulkApprovedAtScheduledEnd: true },
        operatorName,
      },
    });
    approved++;
  }

  revalidatePath("/admin/records");
  revalidatePath("/clock");
  revalidatePath("/titles");

  back.set("approved", String(approved));
  back.set("skipped", String(skipped));
  if (reasons.size > 0) back.set("reasons", [...reasons].join("、"));
  redirect(`/admin/records?${back.toString()}`);
}
