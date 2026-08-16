"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setStaffCookie, clearStaffCookie } from "@/lib/auth";

export async function identifyStaff(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();
  if (!employeeCode) {
    return { error: "社員コードを入力してください" };
  }

  const staff = await prisma.staff.findUnique({ where: { employeeCode } });
  if (!staff || staff.status !== "ACTIVE") {
    return { error: "社員コードが見つかりません" };
  }

  await setStaffCookie(staff.id);
  redirect("/clock");
}

export async function switchUser() {
  await clearStaffCookie();
  redirect("/");
}
