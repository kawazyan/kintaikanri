"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fromJstInputValue } from "@/lib/time";

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
