import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toJstTimeValue } from "@/lib/time";
import { ShiftWizard, type WizardInitialValues } from "./shift-wizard";

export default async function NewShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string }>;
}) {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const { copy } = await searchParams;
  let initial: WizardInitialValues | undefined;

  if (copy) {
    const source = await prisma.shift.findUnique({ where: { id: copy } });
    if (source && source.staffId === staffId) {
      initial = {
        workType: source.workType,
        carrier: source.carrier,
        storeName: source.storeName,
        startTime: toJstTimeValue(source.startTime),
        endTime: toJstTimeValue(source.endTime),
        unitAmount: source.unitAmount,
      };
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <Link href="/shift" className="text-sm text-blue-400 underline">
        ← シフト一覧へ戻る
      </Link>
      <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        シフト新規登録
      </h1>
      <ShiftWizard initial={initial} />
    </main>
  );
}
