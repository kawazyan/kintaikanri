import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../admin-nav";
import { createStaff, updateStaff } from "./actions";

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

      <ul className="flex flex-col gap-3">
        {staffList.map((s) => (
          <li
            key={s.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 shadow-lg shadow-black/40 backdrop-blur-sm"
          >
            <form
              action={updateStaff.bind(null, s.id)}
              className="grid grid-cols-1 gap-2 sm:grid-cols-5 sm:items-center"
            >
              <input
                name="employeeCode"
                defaultValue={s.employeeCode}
                required
                className={FIELD_CLASS}
              />
              <input name="name" defaultValue={s.name} required className={FIELD_CLASS} />
              <input
                name="email"
                type="email"
                defaultValue={s.email}
                required
                className={FIELD_CLASS}
              />
              <select name="status" defaultValue={s.status} className={FIELD_CLASS}>
                <option value="ACTIVE">在籍中</option>
                <option value="RETIRED">退職済み</option>
              </select>
              <button
                type="submit"
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 active:scale-[0.98]"
              >
                保存
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>支払方法: {s.paymentMethod === "FIXED" ? "固定支払" : "申請支払"}</span>
              <Link href={`/admin/staff/${s.id}`} className="text-blue-400 underline">
                詳細・銀行口座・支払方法を編集
              </Link>
            </div>
          </li>
        ))}
        {staffList.length === 0 && (
          <p className="text-sm text-slate-500">スタッフが登録されていません。</p>
        )}
      </ul>
    </main>
  );
}
