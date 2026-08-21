"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteGameData } from "@/lib/game";

export async function createStaff(formData: FormData) {
  await requireAdmin();
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!employeeCode || !name || !email) return;

  await prisma.staff.create({ data: { employeeCode, name, email } });
  revalidatePath("/admin/staff");
}

export async function updateStaff(staffId: string, formData: FormData) {
  await requireAdmin();
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const status = String(formData.get("status") ?? "ACTIVE") as "ACTIVE" | "RETIRED";
  if (!employeeCode || !name || !email) return;

  const before = await prisma.staff.findUnique({ where: { id: staffId }, select: { status: true } });

  await prisma.staff.update({
    where: { id: staffId },
    data: { employeeCode, name, email, status },
  });

  // ゲームデータ(称号・皆勤賞)は退職と同時に無効化する。異動等では削除しない。
  if (before?.status === "ACTIVE" && status === "RETIRED") {
    await deleteGameData(staffId);
  }

  revalidatePath("/admin/staff");
}

function strOrNull(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v || null;
}

function intOrNull(formData: FormData, key: string): number | null {
  const v = String(formData.get(key) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

export async function updateStaffDetails(staffId: string, formData: FormData) {
  await requireAdmin();

  const birthDateRaw = String(formData.get("birthDate") ?? "").trim();
  const paymentMethod = String(formData.get("paymentMethod") ?? "REQUEST") as "FIXED" | "REQUEST";

  await prisma.staff.update({
    where: { id: staffId },
    data: {
      birthDate: birthDateRaw ? new Date(`${birthDateRaw}T00:00:00Z`) : null,
      phoneNumber: strOrNull(formData, "phoneNumber"),
      address: strOrNull(formData, "address"),
      bankName: strOrNull(formData, "bankName"),
      bankBranchName: strOrNull(formData, "bankBranchName"),
      bankAccountNumber: strOrNull(formData, "bankAccountNumber"),
      bankAccountHolder: strOrNull(formData, "bankAccountHolder"),
      invoiceRegistrationNumber: strOrNull(formData, "invoiceRegistrationNumber"),
      paymentMethod,
      fixedClosingDay: paymentMethod === "FIXED" ? intOrNull(formData, "fixedClosingDay") : null,
      fixedPaymentMonthOffset:
        paymentMethod === "FIXED" ? intOrNull(formData, "fixedPaymentMonthOffset") : null,
      fixedPaymentDay: paymentMethod === "FIXED" ? intOrNull(formData, "fixedPaymentDay") : null,
    },
  });

  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${staffId}`);
}
