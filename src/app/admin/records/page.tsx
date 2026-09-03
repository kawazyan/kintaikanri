import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { AdminNav } from "../admin-nav";
import { deleteClockRecord } from "./actions";

export default async function AdminRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ staffId?: string }>;
}) {
  await requireAdmin();
  const { staffId } = await searchParams;

  const [records, staffList] = await Promise.all([
    prisma.clockRecord.findMany({
      where: staffId ? { staffId } : undefined,
      include: { staff: true },
      orderBy: { timestamp: "desc" },
      take: 200,
    }),
    prisma.staff.findMany({ orderBy: { employeeCode: "asc" } }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <AdminNav />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
          打刻記録一覧
        </h1>
        <Link
          href="/admin/records/new"
          className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-1.5 text-sm text-white shadow-md shadow-blue-950/50 active:scale-[0.98]"
        >
          + 打刻を代わりに登録
        </Link>
        <form method="get" className="flex items-center gap-2 text-sm text-slate-400">
          <label htmlFor="staffId">スタッフで絞り込み:</label>
          <select
            id="staffId"
            name="staffId"
            defaultValue={staffId ?? ""}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-slate-100 focus:border-blue-500 focus:outline-none"
          >
            <option value="">全員</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}({s.employeeCode}){s.status === "RETIRED" ? " - 退職済み" : ""}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-1 text-white shadow-md shadow-blue-950/50 active:scale-[0.98]"
          >
            表示
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500">
              <th className="py-2 pr-3 pl-4">スタッフ</th>
              <th className="py-2 pr-3">種別</th>
              <th className="py-2 pr-3">日時</th>
              <th className="py-2 pr-3">店舗</th>
              <th className="py-2 pr-3">シフト</th>
              <th className="py-2 pr-3">位置情報</th>
              <th className="py-2 pr-3">修正</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/60 text-slate-200">
                <td className="py-2 pr-3 pl-4">
                  {r.staff.name}({r.staff.employeeCode})
                </td>
                <td className="py-2 pr-3">{r.type === "IN" ? "出勤" : "退勤"}</td>
                <td className="py-2 pr-3">{formatJst(r.timestamp)}</td>
                <td className="py-2 pr-3">{r.storeName ?? "-"}</td>
                <td className="py-2 pr-3">
                  {r.shiftId ? (
                    "-"
                  ) : (
                    <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                      シフト外
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  {r.latitude != null && r.longitude != null
                    ? `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`
                    : "未取得"}
                </td>
                <td className="py-2 pr-3 text-slate-500">{r.editedByAdmin ? "管理者修正済" : ""}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  <Link href={`/admin/records/${r.id}`} className="text-blue-400 underline">
                    編集
                  </Link>{" "}
                  <form
                    action={deleteClockRecord.bind(null, r.id)}
                    className="inline-flex items-center gap-1"
                  >
                    <input
                      type="text"
                      name="operatorName"
                      placeholder="処理者名"
                      className="w-20 rounded border border-slate-700 bg-slate-900/60 px-1 py-0.5 text-xs text-slate-100 placeholder:text-slate-500"
                    />
                    <button type="submit" className="text-red-400 underline">
                      削除
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && (
          <p className="p-4 text-sm text-slate-500">打刻記録がありません。</p>
        )}
      </div>
    </main>
  );
}
