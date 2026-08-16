import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { WORK_TYPE_LABEL } from "@/lib/carriers";
import { DeleteShiftButton } from "./delete-shift-button";

export default async function ShiftListPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const shifts = await prisma.shift.findMany({
    where: { staffId },
    orderBy: { startTime: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
          シフト一覧
        </h1>
        <Link
          href="/shift/new"
          className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-2 text-sm font-medium text-white shadow-md shadow-blue-950/50 active:scale-[0.98]"
        >
          + 新規登録
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {shifts.map((s) => (
          <li
            key={s.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-300">
                {WORK_TYPE_LABEL[s.workType]}
              </span>
              <div className="flex gap-3">
                <Link href={`/shift/${s.id}`} className="text-blue-400 underline">
                  編集
                </Link>
                <Link href={`/shift/new?copy=${s.id}`} className="text-blue-400 underline">
                  複製
                </Link>
                <DeleteShiftButton shiftId={s.id} />
              </div>
            </div>
            <div className="mt-1 font-medium text-slate-100">
              {formatJst(s.startTime)} 〜 {formatJst(s.endTime)}
            </div>
            <div className="text-slate-400">
              {s.carrier} / {s.storeName}
            </div>
          </li>
        ))}
        {shifts.length === 0 && (
          <p className="text-sm text-slate-500">シフトが登録されていません。</p>
        )}
      </ul>

      <Link href="/clock" className="text-sm text-blue-400 underline">
        打刻画面に戻る
      </Link>
    </main>
  );
}
