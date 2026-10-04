import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toJstTimeValue } from "@/lib/time";
import { ShiftWizard, type WizardInitialValues } from "./shift-wizard";

export default async function NewShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string; date?: string }>;
}) {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const { copy, date } = await searchParams;
  // カレンダーで選んだ日から来た場合は、その日をあらかじめ選択済みにする。
  const initialDate = date && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date) ? date : undefined;
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
    <main className="min-h-dvh bg-gradient-to-b from-white via-[#fdfaf5] to-[#faf5eb]">
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
      <Link href="/shift" className="text-sm text-red-600 underline">
        ← シフト一覧へ戻る
      </Link>
      <h1 className="bg-gradient-to-r from-red-600 to-slate-700 bg-clip-text text-xl font-bold text-transparent">
        シフト新規登録
      </h1>
      <ShiftWizard initial={initial} initialDate={initialDate} />
    </div>
    </main>
  );
}
