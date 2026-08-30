import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jstDayRange } from "@/lib/time";
import { AdminNav } from "../admin-nav";
import { ShiftsTable } from "./shifts-table";
import type { Prisma } from "@prisma/client";

const FIELD_CLASS =
  "rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-slate-100 focus:border-blue-500 focus:outline-none";

export default async function AdminShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ staffId?: string; date?: string; workType?: string }>;
}) {
  await requireAdmin();
  const { staffId, date, workType } = await searchParams;

  const where: Prisma.ShiftWhereInput = {};
  if (staffId) where.staffId = staffId;
  if (workType === "BAND" || workType === "SPOT") where.workType = workType;
  if (date) {
    const { start, end } = jstDayRange(new Date(`${date}T00:00:00+09:00`));
    where.startTime = { gte: start, lt: end };
  }

  const [shifts, staffList] = await Promise.all([
    prisma.shift.findMany({
      where,
      include: { staff: true },
      orderBy: { startTime: "desc" },
      take: 200,
    }),
    prisma.staff.findMany({ orderBy: { employeeCode: "asc" } }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <AdminNav />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
          シフト一覧(全スタッフ)
        </h1>
        <Link href="/admin/shifts/history" className="text-sm text-blue-400 underline">
          変更履歴を見る
        </Link>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm text-slate-400">
        <label className="flex flex-col gap-1">
          スタッフ
          <select name="staffId" defaultValue={staffId ?? ""} className={FIELD_CLASS}>
            <option value="">全員</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}({s.employeeCode})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          日付
          <input type="date" name="date" defaultValue={date ?? ""} className={FIELD_CLASS} />
        </label>
        <label className="flex flex-col gap-1">
          区分
          <select name="workType" defaultValue={workType ?? ""} className={FIELD_CLASS}>
            <option value="">全て</option>
            <option value="BAND">帯稼働</option>
            <option value="SPOT">スポット稼働</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-1.5 text-white shadow-md shadow-blue-950/50 active:scale-[0.98]"
        >
          絞り込み
        </button>
        <Link href="/admin/shifts" className="text-blue-400 underline">
          クリア
        </Link>
      </form>

      <ShiftsTable shifts={shifts} />
    </main>
  );
}
