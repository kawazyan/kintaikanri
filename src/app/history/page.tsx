import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";

export default async function HistoryPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const records = await prisma.clockRecord.findMany({
    where: { staffId },
    orderBy: { timestamp: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        打刻履歴
      </h1>

      <ul className="flex flex-col gap-2 text-sm">
        {records.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 backdrop-blur-sm"
          >
            <span className={r.type === "IN" ? "text-emerald-400" : "text-cyan-400"}>
              {r.type === "IN" ? "出勤" : "退勤"}
            </span>
            <span className="text-slate-200">{formatJst(r.timestamp)}</span>
            <span className="text-slate-500">{r.storeName ?? "-"}</span>
          </li>
        ))}
        {records.length === 0 && (
          <p className="text-sm text-slate-500">打刻履歴はありません。</p>
        )}
      </ul>

      <Link href="/clock" className="text-sm text-blue-400 underline">
        打刻画面に戻る
      </Link>
    </main>
  );
}
