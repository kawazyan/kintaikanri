import { redirect } from "next/navigation";
import { Crown, Award } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllTitlesForStaff, getPerfectAttendanceHistory } from "@/lib/game";
import { formatJst, yearMonthLabel } from "@/lib/time";
import { BottomTabBar } from "@/components/bottom-tab-bar";

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
    <main className="min-h-dvh bg-gradient-to-b from-white via-[#fdfaf5] to-[#faf5eb]">
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 pt-6 pb-28">
      <h1 className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-xl font-bold text-transparent">
        <Award size={20} className="text-red-500" />
        称号・バッジ一覧
      </h1>

      <section className="flex flex-col gap-3">
        {titles.map((t) => (
          <div
            key={t.code}
            className={
              t.achievedAt
                ? "relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-b from-red-400 via-red-600 to-red-900 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_16px_rgba(220,38,38,0.4)] ring-1 ring-amber-400/40"
                : "flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-100 p-4 opacity-70"
            }
          >
            {t.achievedAt && (
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
            )}
            <span
              className={
                t.achievedAt
                  ? "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15"
                  : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200"
              }
            >
              <Crown
                size={18}
                className={t.achievedAt ? "text-amber-300" : "text-slate-400"}
                fill="currentColor"
              />
            </span>
            <div className="relative min-w-0 flex-1">
              <p className={t.achievedAt ? "font-black text-white" : "font-bold text-slate-500"}>
                {t.label}
              </p>
              <p className={t.achievedAt ? "text-xs text-red-100/85" : "text-xs text-slate-500"}>
                連続{t.minStreak}勤務達成で獲得
              </p>
            </div>
            <div className="relative text-right text-xs">
              {t.achievedAt ? (
                <span className="text-red-100/85">{formatJst(t.achievedAt)}</span>
              ) : (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-500">未獲得</span>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-gradient-to-b from-white to-slate-100 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-amber-600 uppercase">
          皆勤賞の履歴
        </h2>
        {perfectAttendances.length === 0 ? (
          <p className="text-sm text-slate-500">まだ皆勤賞の実績がありません。</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {perfectAttendances.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between border-b border-slate-200 py-1 text-slate-700 last:border-0"
              >
                <span>{yearMonthLabel(p.yearMonth)}</span>
                <span className="text-amber-600">🏆 皆勤賞</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>

      <BottomTabBar />
    </main>
  );
}
