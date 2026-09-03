import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../../admin-nav";
import { ShiftWizard } from "@/app/shift/new/shift-wizard";

export default async function AdminNewShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ staffId?: string }>;
}) {
  await requireAdmin();
  const { staffId } = await searchParams;

  const staffList = await prisma.staff.findMany({
    where: { status: "ACTIVE" },
    orderBy: { employeeCode: "asc" },
  });

  const selectedStaff = staffId ? staffList.find((s) => s.id === staffId) : undefined;

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <AdminNav />
      <Link href="/admin/shifts" className="text-sm text-blue-400 underline">
        ← シフト一覧へ戻る
      </Link>
      <h1 className="mt-3 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        スタッフのシフトを登録
      </h1>

      <form method="get" className="mt-4 flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm text-slate-300">
          対象スタッフ
          <select
            name="staffId"
            defaultValue={staffId ?? ""}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none"
          >
            <option value="" disabled>
              選択してください
            </option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}({s.employeeCode})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200">
          選択する
        </button>
      </form>

      {selectedStaff && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-bold text-slate-200">
            {selectedStaff.name}さんのシフトを登録します
          </p>
          <ShiftWizard staffId={selectedStaff.id} />
        </div>
      )}
    </main>
  );
}
