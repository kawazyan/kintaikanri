import { redirect } from "next/navigation";
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        振込申請
      </h1>
      <RequestForm availableAmount={balance.availableAmount} />
    </main>
  );
}
