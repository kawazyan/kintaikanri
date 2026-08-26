import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeTransferBalance } from "@/lib/earnings";
import { RequestForm } from "./request-form";

export default async function PaymentRequestPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");
  if (staff.paymentMethod !== "REQUEST") redirect("/clock");

  const balance = await computeTransferBalance(staffId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-gradient-to-b from-white via-[#fdfaf5] to-[#faf5eb] px-4 py-8">
      <Link href="/clock" className="text-sm text-red-600 underline">
        ← ホームへ戻る
      </Link>
      <h1 className="bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-xl font-bold text-transparent">
        振込申請
      </h1>
      <RequestForm availableAmount={balance.availableAmount} />
    </main>
  );
}
