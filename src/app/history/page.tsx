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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-gradient-to-b from-white via-[#fdfaf5] to-[#faf5eb] px-4 pt-8 pb-28">
      <h1 className="bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-xl font-bold text-transparent">
        打刻履歴
      </h1>

      <ul className="flex flex-col gap-2 text-sm">
        {records.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-xl bg-gradient-to-b from-white to-slate-100 px-3 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.3)]"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                r.type === "IN" ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600"
              }`}
            >
              {r.type === "IN" ? <LogIn size={16} /> : <LogOut size={16} />}
            </span>
            <span className={r.type === "IN" ? "text-emerald-600" : "text-red-600"}>
              {r.type === "IN" ? "出勤" : "退勤"}
            </span>
            <span className="flex-1 text-right text-slate-800">{formatJst(r.timestamp)}</span>
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
