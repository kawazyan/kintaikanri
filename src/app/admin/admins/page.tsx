import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../admin-nav";
import { addAdminEmail, deleteAdminEmail } from "./actions";

export default async function AdminAdminsPage() {
  await requireAdmin();
  const admins = await prisma.adminEmail.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <AdminNav />
      <h1 className="mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        管理者アドレス管理
      </h1>
      <p className="mb-4 text-sm text-slate-500">
        未出勤アラート・シフト変更通知の送信先です。
      </p>

      <form action={addAdminEmail} className="mb-6 flex gap-3">
        <input
          name="email"
          type="email"
          placeholder="admin@example.com"
          required
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-2 text-sm text-white shadow-md shadow-blue-950/50 active:scale-[0.98]"
        >
          追加
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {admins.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 backdrop-blur-sm"
          >
            <span>{a.email}</span>
            <form action={deleteAdminEmail.bind(null, a.id)}>
              <button type="submit" className="text-red-400 underline">
                削除
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
