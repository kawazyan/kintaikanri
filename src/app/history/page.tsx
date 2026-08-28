import { redirect } from "next/navigation";
import { Clock3, History, LogIn, LogOut, MapPin, PencilLine, CalendarCheck2 } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentJstYearMonth, jstMonthRange, toJstDateValue, toJstTimeValue, yearMonthLabel } from "@/lib/time";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { PageHeader } from "@/components/page-header";

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

function dayLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}月${d}日（${weekday}）`;
}

function minutesLabel(minutes: number) {
  const safe = Math.max(0, minutes);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}

export default async function HistoryPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const yearMonth = currentJstYearMonth();
  const { start, end } = jstMonthRange(yearMonth);
  const records = await prisma.clockRecord.findMany({
    where: { staffId, timestamp: { gte: start, lt: end } },
    orderBy: { timestamp: "desc" },
    take: 500,
  });

  const grouped = new Map<string, typeof records>();
  for (const record of records) {
    const key = toJstDateValue(record.timestamp);
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }

  const days = [...grouped.entries()].map(([dateKey, dayRecords]) => {
    const asc = [...dayRecords].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const firstIn = asc.find((r) => r.type === "IN") ?? null;
    const lastOut = [...asc].reverse().find((r) => r.type === "OUT") ?? null;

    let openIn: Date | null = null;
    let workedMinutes = 0;
    let completedSessions = 0;
    let hasUnpairedPunch = false;

    for (const record of asc) {
      if (record.type === "IN") {
        if (openIn) hasUnpairedPunch = true;
        openIn = record.timestamp;
      } else if (openIn && record.timestamp > openIn) {
        workedMinutes += Math.floor((record.timestamp.getTime() - openIn.getTime()) / 60000);
        completedSessions += 1;
        openIn = null;
      } else {
        hasUnpairedPunch = true;
      }
    }
    if (openIn) hasUnpairedPunch = true;

    return {
      dateKey,
      firstIn,
      lastOut,
      workedMinutes,
      completedSessions,
      complete: completedSessions > 0 && !hasUnpairedPunch,
      edited: asc.some((r) => r.editedByAdmin),
      storeName: asc.find((r) => r.storeName)?.storeName ?? null,
    };
  });

  const workDays = days.filter((d) => d.firstIn).length;
  const totalMinutes = days.reduce((sum, day) => sum + day.workedMinutes, 0);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#fffdfb] via-[#fdf9f4] to-[#f7f0e7] text-slate-900">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28">
        <PageHeader icon={History} title="打刻履歴" eyebrow={yearMonthLabel(yearMonth)} />

        <section className="grid grid-cols-2 gap-3">
          <div className="relative overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,.07)] ring-1 ring-black/[.04]">
            <CalendarCheck2 size={18} className="text-red-500" />
            <p className="mt-3 text-[10px] font-black tracking-wide text-slate-400">今月の勤務日数</p>
            <p className="mt-0.5 text-[28px] font-black leading-none tabular-nums text-slate-950">
              {workDays}<span className="ml-1 text-xs text-slate-400">日</span>
            </p>
          </div>
          <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-red-500 via-red-600 to-red-700 p-4 text-white shadow-[0_10px_22px_rgba(220,38,38,.20)] ring-1 ring-red-400/20">
            <span className="pointer-events-none absolute -right-5 -top-6 h-20 w-20 rounded-full bg-white/15 blur-xl" />
            <Clock3 size={18} className="relative text-white/90" />
            <p className="relative mt-3 text-[10px] font-black tracking-wide text-white/70">記録済み勤務時間</p>
            <p className="relative mt-0.5 text-[22px] font-black leading-none tabular-nums">{minutesLabel(totalMinutes)}</p>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          {days.map((day) => (
            <article key={day.dateKey} className="overflow-hidden rounded-[24px] bg-white shadow-[0_8px_24px_rgba(15,23,42,.07)] ring-1 ring-black/[.04]">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-[15px] font-black text-slate-950">{dayLabel(day.dateKey)}</p>
                  {day.storeName ? (
                    <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] font-semibold text-slate-400">
                      <MapPin size={11} className="shrink-0" />
                      <span className="truncate">{day.storeName}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {day.edited ? (
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 ring-1 ring-amber-100">
                      <PencilLine size={10} />修正済み
                    </span>
                  ) : null}
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${day.complete ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-amber-50 text-amber-700 ring-amber-100"}`}>
                    {day.complete ? "勤務完了" : "打刻確認中"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-100 py-4 text-center">
                <div className="px-3">
                  <p className="flex items-center justify-center gap-1 text-[10px] font-black text-emerald-600"><LogIn size={12}/>出勤</p>
                  <p className="mt-1 text-[25px] font-black tabular-nums tracking-tight text-slate-950">{day.firstIn ? toJstTimeValue(day.firstIn.timestamp) : "--:--"}</p>
                </div>
                <div className="px-3">
                  <p className="flex items-center justify-center gap-1 text-[10px] font-black text-red-600"><LogOut size={12}/>退勤</p>
                  <p className="mt-1 text-[25px] font-black tabular-nums tracking-tight text-slate-950">{day.lastOut ? toJstTimeValue(day.lastOut.timestamp) : "--:--"}</p>
                </div>
              </div>

              <div className="mx-4 mb-4 flex items-center justify-between rounded-[16px] bg-slate-50 px-3.5 py-3 ring-1 ring-slate-100">
                <span className="flex items-center gap-1.5 text-[11px] font-black text-slate-400"><Clock3 size={13}/>勤務時間</span>
                <div className="text-right">
                  <span className="text-sm font-black text-slate-800">{day.workedMinutes > 0 ? minutesLabel(day.workedMinutes) : "－"}</span>
                  {day.completedSessions > 1 ? <p className="mt-0.5 text-[9px] font-bold text-slate-400">{day.completedSessions}回の勤務を合算</p> : null}
                </div>
              </div>
            </article>
          ))}

          {days.length === 0 ? (
            <div className="rounded-[24px] bg-white px-5 py-12 text-center shadow-[0_8px_24px_rgba(15,23,42,.07)] ring-1 ring-black/[.04]">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-slate-50 ring-1 ring-slate-100"><History size={26} className="text-slate-300" /></span>
              <p className="mt-4 text-sm font-black text-slate-700">今月の打刻履歴はありません</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">出勤・退勤を打刻するとここに表示されます</p>
            </div>
          ) : null}
        </section>
      </div>
      <BottomTabBar />
    </main>
  );
}
