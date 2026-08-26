import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toJstDateValue, toJstTimeValue } from "@/lib/time";
import { EditShiftForm } from "./edit-shift-form";

export default async function EditShiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const { id } = await params;
  const shift = await prisma.shift.findUnique({ where: { id } });

  if (!shift || shift.staffId !== staffId) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-gradient-to-b from-white via-[#fdfaf5] to-[#faf5eb] px-4 py-8">
      <Link href="/shift" className="text-sm text-red-600 underline">
        ← シフト一覧へ戻る
      </Link>
      <h1 className="bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-xl font-bold text-transparent">
        シフト編集
      </h1>
      <EditShiftForm
        shiftId={shift.id}
        defaultValues={{
          workType: shift.workType,
          carrier: shift.carrier,
          storeName: shift.storeName,
          date: toJstDateValue(shift.startTime),
          startTime: toJstTimeValue(shift.startTime),
          endTime: toJstTimeValue(shift.endTime),
          unitAmount: shift.unitAmount,
        }}
      />
    </main>
  );
}
