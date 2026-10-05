import { prisma } from "@/lib/prisma";
import { formatJst, jstDayRange, toJstDateValue } from "@/lib/time";
import { KIND_LABEL, SimplePanel } from "./simple-panel";
import { LiveClock } from "./live-clock";

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

// 簡易モード(出勤・退勤・欠勤・遅刻・早退のボタンだけ)の打刻画面。
export async function SimpleClockScreen({ staffId, staffName }: { staffId: string; staffName: string }) {
  const now = new Date();
  const today = toJstDateValue(now);
  const { start: todayStart, end: todayEnd } = jstDayRange(now);
  const since = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const sinceDate = toJstDateValue(since);

  const [todayRecords, recentRecords, recentEntries] = await Promise.all([
    prisma.clockRecord.findMany({ where: { staffId, timestamp: { gte: todayStart, lt: todayEnd } }, orderBy: { timestamp: "asc" } }),
    prisma.clockRecord.findMany({ where: { staffId, timestamp: { gte: since } }, orderBy: { timestamp: "asc" } }),
    prisma.simpleAttendanceEntry.findMany({ where: { staffId, date: { gte: sinceDate } }, orderBy: { createdAt: "asc" } }),
  ]);

  const todayIn = todayRecords.find((r) => r.type === "IN");
  const todayOut = [...todayRecords].reverse().find((r) => r.type === "OUT");
  const hhmm = (d?: Date) => (d ? formatJst(d).slice(-5) : "--:--");

  const byDate = new Map<string, { in?: Date; out?: Date; kinds: string[] }>();
  const get = (k: string) => byDate.get(k) ?? byDate.set(k, { kinds: [] }).get(k)!;
  for (const r of recentRecords) {
    const e = get(toJstDateValue(r.timestamp));
    if (r.type === "IN" && !e.in) e.in = r.timestamp;
    if (r.type === "OUT") e.out = r.timestamp;
  }
  for (const en of recentEntries) get(en.date).kinds.push(KIND_LABEL[en.kind]);
  const history = [...byDate.entries()]
    .filter(([k]) => k !== today)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 7);

  return (
    <main className="staff-screen">
      <div className="mx-auto max-w-[430px] px-4 pb-16 pt-[calc(48px_+_env(safe-area-inset-top))]">
        <p className="text-center text-sm font-bold text-slate-600">{staffName} さん</p>
        <div className="mt-2 flex justify-center"><LiveClock /></div>

        <div className="mt-5">
          <SimplePanel entries={recentEntries.filter((e) => e.date === today).map((e) => ({ id: e.id, kind: e.kind }))} />
        </div>

        <p className="mt-4 rounded-full bg-white/80 px-3 py-1.5 text-center text-sm font-bold text-slate-700 shadow-sm">
          本日  出勤 {hhmm(todayIn?.timestamp)} / 退勤 {hhmm(todayOut?.timestamp)}
        </p>

        {history.length > 0 && (
          <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-700">最近の記録</h2>
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {history.map(([k, v]) => {
                const [y, m, d] = k.split("-").map(Number);
                const wd = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
                return (
                  <li key={k} className="flex items-center justify-between gap-2 py-2">
                    <span className="font-bold">{m}/{d}({wd})</span>
                    <span className="text-slate-600">{hhmm(v.in)} - {hhmm(v.out)}</span>
                    <span className="min-w-[4rem] text-right font-black text-amber-700">{v.kinds.join("・")}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
