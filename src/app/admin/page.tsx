import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "./admin-nav";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [staffCount, shiftCount, recordCount, adminCount] = await Promise.all([
    prisma.staff.count({ where: { status: "ACTIVE" } }),
    prisma.shift.count(),
    prisma.clockRecord.count(),
    prisma.adminEmail.count(),
  ]);

  const stats = [
    { label: "在籍スタッフ数", value: staffCount },
    { label: "登録シフト数", value: shiftCount },
    { label: "打刻記録数", value: recordCount },
    { label: "管理者アドレス数", value: adminCount },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <AdminNav />
      <h1 className="mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        管理ダッシュボード
      </h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur-sm"
          >
            <p className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-2xl font-bold text-transparent">
              {s.value}
            </p>
            <p className="text-sm text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
