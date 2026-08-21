import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllTitlesForStaff, getPerfectAttendanceHistory } from "@/lib/game";
import { formatJst, yearMonthLabel } from "@/lib/time";

export default async function TitlesPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  const [titles, perfectAttendances] = await Promise.all([
    getAllTitlesForStaff(staffId),
    getPerfectAttendanceHistory(staffId),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-4 py-6">
      <div>
        <Link href="/clock" className="text-sm text-blue-400 underline">
          ← ホームへ戻る
        </Link>
        <h1 className="mt-2 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
          称号・バッジ一覧
        </h1>
      </div>

      <section className="flex flex-col gap-3">
        {titles.map((t) => (
          <div
            key={t.code}
            className={
              t.achievedAt
                ? "flex items-center justify-between rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-600/20 to-cyan-500/10 p-4"
                : "flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/40 p-4 opacity-60"
            }
          >
            <div>
              <p className={t.achievedAt ? "font-bold text-cyan-300" : "font-bold text-slate-500"}>
                {t.label}
              </p>
              <p className="text-xs text-slate-500">連続{t.minStreak}勤務達成で獲得</p>
            </div>
            <div className="text-right text-xs">
              {t.achievedAt ? (
                <span className="text-slate-400">{formatJst(t.achievedAt)}</span>
              ) : (
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-500">未獲得</span>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-amber-400/80 uppercase">
          皆勤賞の履歴
        </h2>
        {perfectAttendances.length === 0 ? (
          <p className="text-sm text-slate-500">まだ皆勤賞の実績がありません。</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {perfectAttendances.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between border-b border-slate-800 py-1 text-slate-300 last:border-0"
              >
                <span>{yearMonthLabel(p.yearMonth)}</span>
                <span className="text-amber-300">🏆 皆勤賞</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
