import { redirect } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { BottomTabBar } from "@/components/bottom-tab-bar";

export default async function HistoryPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const records = await prisma.clockRecord.findMany({
    where: { staffId },
    orderBy: { timestamp: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pt-8 pb-28">
      <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        打刻履歴
      </h1>

      <ul className="flex flex-col gap-2 text-sm">
        {records.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 shadow-md shadow-black/30 backdrop-blur-sm"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                r.type === "IN" ? "bg-emerald-500/10 text-emerald-400" : "bg-cyan-500/10 text-cyan-400"
              }`}
            >
              {r.type === "IN" ? <LogIn size={16} /> : <LogOut size={16} />}
            </span>
            <span className={r.type === "IN" ? "text-emerald-400" : "text-cyan-400"}>
              {r.type === "IN" ? "出勤" : "退勤"}
            </span>
            <span className="flex-1 text-right text-slate-200">{formatJst(r.timestamp)}</span>
            <span className="w-20 shrink-0 truncate text-right text-xs text-slate-500">
              {r.storeName ?? "-"}
            </span>
          </li>
        ))}
        {records.length === 0 && (
          <p className="text-sm text-slate-500">打刻履歴はありません。</p>
        )}
      </ul>

      <BottomTabBar />
    </main>
  );
}
