import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayShiftStatusSummary } from "@/lib/attendance";
import { jstDayRange, formatJst } from "@/lib/time";
import { IRREGULAR_REPORT_TYPE_LABEL } from "@/lib/attendance-requests";
import { AdminNav } from "../admin-nav";

const FILTER_LABEL: Record<string, string> = {
  scheduled: "本日稼働予定",
  clocked_in: "出勤済み",
  not_clocked_in: "未出勤",
  clocked_out: "退勤済み",
  irregular: "本日分のイレギュラー報告",
};

export default async function AdminTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAdmin();
  const { filter = "scheduled" } = await searchParams;

  const summary = await getTodayShiftStatusSummary();
  const rows =
    filter === "clocked_in"
      ? summary.clockedIn
      : filter === "not_clocked_in"
        ? summary.notClockedIn
        : filter === "clocked_out"
          ? summary.clockedOut
          : [...summary.clockedIn, ...summary.notClockedIn, ...summary.clockedOut];

  const irregularReports =
    filter === "irregular"
      ? await (async () => {
          const { start, end } = jstDayRange();
          return prisma.irregularReport.findMany({
            where: { targetDate: { gte: start, lt: end } },
            include: { staff: true },
            orderBy: { createdAt: "desc" },
          });
        })()
      : [];

  const STATUS_LABEL: Record<string, string> = { clockedIn: "出勤済み", notClockedIn: "未出勤", clockedOut: "退勤済み" };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-100">
      <AdminNav />
      <div className="mb-2 text-sm">
        <Link href="/admin" className="text-blue-400 underline">
          ← ダッシュボードへ戻る
        </Link>
      </div>
      <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        {FILTER_LABEL[filter] ?? "本日稼働予定"}
      </h1>

      {filter === "irregular" ? (
        <div className="mt-6 space-y-3">
          {irregularReports.length ? (
            irregularReports.map((r) => (
              <article key={r.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
                <p className="font-black">
                  {r.staff.name} ・ {IRREGULAR_REPORT_TYPE_LABEL[r.reportType]}
                </p>
                <p className="mt-1 text-sm text-slate-400">{r.reason}</p>
                <p className="mt-1 text-xs text-slate-500">送信: {formatJst(r.createdAt)}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-400">本日分のイレギュラー報告はありません。</p>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-900">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                <th className="px-4 py-3">スタッフ名</th>
                <th className="px-4 py-3">稼働場所</th>
                <th className="px-4 py-3">予定勤務時間</th>
                <th className="px-4 py-3">出勤時間</th>
                <th className="px-4 py-3">退勤時間</th>
                <th className="px-4 py-3">状態</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.shiftId} className="border-b border-slate-800 last:border-0">
                    <td className="px-4 py-3 font-black">{row.staffName}</td>
                    <td className="px-4 py-3 text-slate-300">{row.storeName}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.scheduledStart} 〜 {row.scheduledEnd}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.inTime ?? "--:--"}</td>
                    <td className="px-4 py-3 text-slate-300">{row.outTime ?? "--:--"}</td>
                    <td className="px-4 py-3">
                      {row.bucket ? STATUS_LABEL[row.bucket] : "開始前"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400" colSpan={6}>
                    該当するスタッフはいません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
