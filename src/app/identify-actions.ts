"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setStaffCookie, clearStaffCookie } from "@/lib/auth";

export type IdentifyState =
  | { step: "input"; error?: string }
  | { step: "confirm"; employeeCode: string; staffName: string; error?: string };

export async function identifyStaff(
  _prevState: IdentifyState | null,
  formData: FormData
): Promise<IdentifyState> {
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();

  if (!employeeCode) {
    return { step: "input", error: "社員コードを入力してください" };
  }

  const staff = await prisma.staff.findUnique({
    where: { employeeCode },
    select: { name: true, status: true },
  });

  if (!staff || staff.status !== "ACTIVE") {
    return { step: "input", error: "社員コードが見つかりません" };
  }

  return {
    step: "confirm",
    employeeCode,
    staffName: staff.name,
  };
}

export async function confirmStaffLogin(formData: FormData): Promise<void> {
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();

  if (!employeeCode) {
    redirect("/");
  }

  const staff = await prisma.staff.findUnique({ where: { employeeCode } });
  if (!staff || staff.status !== "ACTIVE") {
    redirect("/?error=not-found");
  }

  await setStaffCookie(staff.id);
  redirect("/clock");
}

export async function switchUser() {
  await clearStaffCookie();
  redirect("/");
}
