import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst, jstDayRange } from "@/lib/time";
import { WORK_TYPE_LABEL } from "@/lib/carriers";
import { AdminNav } from "../admin-nav";
import { adminDeleteShift } from "./actions";
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

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500">
              <th className="py-2 pr-3 pl-4">スタッフ</th>
              <th className="py-2 pr-3">区分</th>
              <th className="py-2 pr-3">開始</th>
              <th className="py-2 pr-3">終了</th>
              <th className="py-2 pr-3">キャリア</th>
              <th className="py-2 pr-3">店舗</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className="border-b border-slate-800/60 text-slate-200">
                <td className="py-2 pr-3 pl-4">
                  {s.staff.name}({s.staff.employeeCode})
                </td>
                <td className="py-2 pr-3">{WORK_TYPE_LABEL[s.workType]}</td>
                <td className="py-2 pr-3">{formatJst(s.startTime)}</td>
                <td className="py-2 pr-3">{formatJst(s.endTime)}</td>
                <td className="py-2 pr-3">{s.carrier}</td>
                <td className="py-2 pr-3">{s.storeName}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  <Link href={`/admin/shifts/${s.id}`} className="text-blue-400 underline">
                    編集
                  </Link>{" "}
                  <form action={adminDeleteShift.bind(null, s.id)} className="inline">
                    <button type="submit" className="text-red-400 underline">
                      削除
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shifts.length === 0 && (
          <p className="p-4 text-sm text-slate-500">シフトが登録されていません。</p>
        )}
      </div>
    </main>
  );
}
