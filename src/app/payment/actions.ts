"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStaffId } from "@/lib/auth";
import { computeTransferBalance } from "@/lib/earnings";
import { fromJstInputValue } from "@/lib/time";

export async function createTransferRequest(input: {
  amount: number;
  desiredDate: string; // "YYYY-MM-DD"
}): Promise<{ error: string } | { ok: true }> {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");
  if (staff.paymentMethod !== "REQUEST") {
    return { error: "振込申請は申請支払のスタッフのみ利用できます" };
  }

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return { error: "申請金額を正しく入力してください" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.desiredDate)) {
    return { error: "希望振込日を選択してください" };
  }

  // Recomputed server-side — never trust a client-supplied "available amount".
  const balance = await computeTransferBalance(staffId);
  if (input.amount > balance.availableAmount) {
    return { error: "振込申請可能額を超えています" };
  }

  await prisma.transferRequest.create({
    data: {
      staffId,
      amount: input.amount,
      desiredPaymentDate: fromJstInputValue(`${input.desiredDate}T00:00`),
      status: "REQUESTING",
    },
  });

  revalidatePath("/clock");
  revalidatePath("/payment/history");
  return { ok: true };
}
