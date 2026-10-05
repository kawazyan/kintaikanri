import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentJstYearMonth, formatJst, jstMonthRange, listDaysInJstYearMonth, listMonthOptions, toJstDateValue } from "@/lib/time";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";

const KIND_LABEL = { ABSENT: "欠勤", LATE: "遅刻", EARLY_LEAVE: "早退" } as const;
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

// 簡易モードのスタッフの出勤・退勤・欠勤・遅刻・早退を、月ごとに一覧で見る画面。
export default async function AdminSimpleAttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const { month: monthRaw } = await searchParams;
  const month = monthRaw && /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : currentJstYearMonth();
  const { start, end } = jstMonthRange(month);
  const days = listDaysInJstYearMonth(month);
  const firstDate = days[0]?.dateKey;
  const lastDate = days[days.length - 1]?.dateKey;

  const people = await prisma.staff.findMany({
    where: { simpleMode: true, status: "ACTIVE" },
    orderBy: { employeeCode: "asc" },
    select: { id: true, name: true, employeeCode: true },
  });
  const ids = people.map((p) => p.id);
  const [records, entries] = await Promise.all([
    prisma.clockRecord.findMany({ where: { staffId: { in: ids }, timestamp: { gte: start, lt: end } }, orderBy: { timestamp: "asc" } }),
    prisma.simpleAttendanceEntry.findMany({ where: { staffId: { in: ids }, date: { gte: firstDate, lte: lastDate } }, orderBy: { createdAt: "asc" } }),
  ]);
  const monthOptions = listMonthOptions(6, 1);
  const hhmm = (d?: Date) => (d ? formatJst(d).slice(-5) : "--:--");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <AdminNav />
      <h1 className="mb-2 text-xl font-bold text-slate-100">簡易勤怠(出勤・退勤・欠勤・遅刻・早退)</h1>
      <p className="mb-4 text-xs text-slate-400">
        スタッフ詳細で「簡易モード」にした人の記録です。打刻の修正・削除は「打刻記録」の画面でできます。
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        {monthOptions.map((o) => (
          <Link key={o.value} href={`/admin/simple-attendance?month=${o.value}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${o.value === month ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>
            {o.label}
          </Link>
        ))}
      </div>

      {people.length === 0 && (
        <p className="rounded-lg border border-slate-700 p-4 text-sm text-slate-300">簡易モードのスタッフはいません。スタッフ詳細で「簡易モード」にチェックを入れてください。</p>
      )}

      {people.map((p) => {
        const byDate = new Map<string, { in?: Date; out?: Date; kinds: string[] }>();
        const get = (k: string) => byDate.get(k) ?? byDate.set(k, { kinds: [] }).get(k)!;
        for (const r of records) {
          if (r.staffId !== p.id) continue;
          const e = get(toJstDateValue(r.timestamp));
          if (r.type === "IN" && !e.in) e.in = r.timestamp;
          if (r.type === "OUT") e.out = r.timestamp;
        }
        const mine = entries.filter((e) => e.staffId === p.id);
        for (const e of mine) get(e.date).kinds.push(KIND_LABEL[e.kind]);
        const count = (k: keyof typeof KIND_LABEL) => mine.filter((e) => e.kind === k).length;
        const workDays = [...byDate.values()].filter((v) => v.in).length;
        const rows = days.filter((d) => byDate.has(d.dateKey));
        return (
          <section key={p.id} className="mb-6 rounded-2xl border border-slate-700 bg-slate-900/40 p-4">
            <h2 className="font-bold text-slate-100">{p.name}<span className="ml-2 text-xs font-normal text-slate-400">({p.employeeCode})</span></h2>
            <p className="mt-1 text-sm text-slate-300">
              出勤 {workDays}日 / 欠勤 {count("ABSENT")}回 / 遅刻 {count("LATE")}回 / 早退 {count("EARLY_LEAVE")}回
            </p>
            {rows.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">この月の記録はありません。</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400"><th className="py-1">日付</th><th>出勤</th><th>退勤</th><th>欠勤・遅刻・早退</th></tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    const v = byDate.get(d.dateKey)!;
                    const [y, m, day] = d.dateKey.split("-").map(Number);
                    const wd = WEEKDAY[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
                    return (
                      <tr key={d.dateKey} className="border-t border-slate-800 text-slate-200">
                        <td className="py-1.5 font-bold">{m}/{day}({wd})</td>
                        <td>{hhmm(v.in)}</td>
                        <td>{hhmm(v.out)}</td>
                        <td className="font-bold text-amber-400">{v.kinds.join("・")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </main>
  );
}
