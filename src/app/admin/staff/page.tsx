import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../admin-nav";
import { createStaff } from "./actions";
import { StaffList } from "./staff-list";

const FIELD_CLASS =
  "rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ showRetired?: string }>;
}) {
  await requireAdmin();
  const { showRetired } = await searchParams;

  const staffList = await prisma.staff.findMany({
    where: showRetired ? {} : { status: "ACTIVE" },
    orderBy: { employeeCode: "asc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <AdminNav />
      <h1 className="mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        スタッフ管理
      </h1>

      <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">新規スタッフ登録</h2>
        <form action={createStaff} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input name="employeeCode" placeholder="社員コード" required className={FIELD_CLASS} />
          <input name="name" placeholder="氏名" required className={FIELD_CLASS} />
          <input
            name="email"
            type="email"
            placeholder="メールアドレス"
            required
            className={FIELD_CLASS}
          />
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-2 text-sm font-medium text-white shadow-md shadow-blue-950/50 active:scale-[0.98]"
          >
            追加
          </button>
        </form>
      </section>

      <div className="mb-3 text-sm">
        <a
          href={showRetired ? "/admin/staff" : "/admin/staff?showRetired=1"}
          className="text-blue-400 underline"
        >
          {showRetired ? "在籍中のみ表示" : "退職済みも表示"}
        </a>
      </div>

      <StaffList staffList={staffList} />
    </main>
  );
}
