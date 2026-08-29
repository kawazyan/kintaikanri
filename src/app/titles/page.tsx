import { redirect } from "next/navigation";
import { Crown, Award, Trophy, LockKeyhole, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
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

  const achievedCount = titles.filter((title) => title.achievedAt).length;

  return (
    <main className="staff-screen">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28">
        <PageHeader icon={Award} title="獲得した称号" eyebrow="TITLE COLLECTION" />

        <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-5 text-white shadow-[0_12px_28px_rgba(15,23,42,.20)] ring-1 ring-white/10">
          <span className="pointer-events-none absolute -right-7 -top-8 h-28 w-28 rounded-full bg-red-500/20 blur-2xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-black tracking-[.12em] text-amber-300"><Sparkles size={12}/> COLLECTION</p>
              <p className="mt-1 text-sm font-black text-white">獲得状況</p>
            </div>
            <div className="text-right">
              <p className="text-[30px] font-black leading-none tabular-nums">{achievedCount}<span className="mx-1 text-sm text-white/50">/</span><span className="text-lg text-white/70">{titles.length}</span></p>
              <p className="mt-1 text-[9px] font-bold text-white/45">獲得済み</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          {titles.map((title) => {
            const achieved = Boolean(title.achievedAt);
            return (
              <article
                key={title.code}
                className={achieved
                  ? "relative overflow-hidden rounded-[24px] bg-gradient-to-br from-red-500 via-red-600 to-red-800 p-4 text-white shadow-[0_9px_22px_rgba(220,38,38,.22)] ring-1 ring-red-400/30"
                  : "rounded-[24px] bg-white p-4 shadow-[0_7px_20px_rgba(15,23,42,.06)] ring-1 ring-black/[.05]"}
              >
                {achieved ? <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" /> : null}
                <div className="relative flex items-center gap-3">
                  <span className={achieved
                    ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] bg-white/16 ring-1 ring-white/20"
                    : "flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] bg-slate-100 ring-1 ring-slate-200"}
                  >
                    {achieved ? <Crown size={22} className="text-amber-300" fill="currentColor" /> : <LockKeyhole size={19} className="text-slate-400" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={achieved ? "truncate text-[15px] font-black text-white" : "truncate text-[15px] font-black text-slate-600"}>{title.label}</p>
                    <p className={achieved ? "mt-0.5 text-[11px] font-semibold text-white/70" : "mt-0.5 text-[11px] font-semibold text-slate-400"}>連続{title.minStreak}勤務達成で獲得</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {title.achievedAt ? (
                      <>
                        <span className="inline-flex rounded-full bg-white/14 px-2 py-1 text-[9px] font-black text-white ring-1 ring-white/15">獲得済み</span>
                        <p className="mt-1 text-[9px] font-bold text-white/55">{formatJst(title.achievedAt)}</p>
                      </>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-400">未獲得</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-[24px] bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,.07)] ring-1 ring-black/[.04]">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-amber-50 ring-1 ring-amber-100"><Trophy size={17} className="text-amber-600" /></span>
            <div>
              <p className="text-[10px] font-black tracking-[.1em] text-amber-600">PERFECT ATTENDANCE</p>
              <h2 className="text-sm font-black text-slate-900">皆勤賞の履歴</h2>
            </div>
          </div>

          {perfectAttendances.length === 0 ? (
            <div className="rounded-[16px] bg-slate-50 px-4 py-4 text-center ring-1 ring-slate-100">
              <p className="text-xs font-bold text-slate-400">まだ皆勤賞の実績がありません</p>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-[16px] bg-slate-50 ring-1 ring-slate-100">
              {perfectAttendances.map((item) => (
                <li key={item.id} className="flex items-center justify-between border-b border-slate-200/70 px-3 py-3 text-sm last:border-0">
                  <span className="font-bold text-slate-600">{yearMonthLabel(item.yearMonth)}</span>
                  <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700"><Trophy size={11}/>皆勤賞</span>
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
