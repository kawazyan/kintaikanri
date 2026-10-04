import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientAutoRefresh } from "@/app/client/components/auto-refresh";
import { findActiveViewToken, loadClientAttendance, normalizeYearMonth, type ViewRow, type ViewStatus } from "@/lib/client-view";
import { currentJstYearMonth, toJstDateValue, yearMonthLabel } from "@/lib/time";

// 取引先向けの出退勤の閲覧専用ページ。ログイン不要(URLのトークンが鍵)。検索エンジンには出さない。
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "出退勤状況",
  robots: { index: false, follow: false },
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const dayLabel = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${m}/${day}(${WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]})`;
};
const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const BADGE: Record<ViewStatus, string> = {
  出勤前: "bg-slate-100 text-slate-600",
  未出勤: "bg-amber-100 text-amber-800",
  出勤中: "bg-emerald-100 text-emerald-800",
  退勤済み: "bg-sky-100 text-sky-800",
  退勤未打刻: "bg-orange-100 text-orange-800",
  欠勤: "bg-rose-100 text-rose-800",
  キャンセル: "bg-slate-200 text-slate-500",
};

function StatusBadge({ row }: { row: ViewRow }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${BADGE[row.status]}`}>{row.status}</span>
      {row.notes.map((n) => <span key={n} className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-black text-rose-800">{n}</span>)}
    </span>
  );
}

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { token } = await params;
  const access = await findActiveViewToken(token);
  if (!access) notFound();

  const { month } = await searchParams;
  const ym = normalizeYearMonth(month);
  const now = new Date();
  const todayKey = toJstDateValue(now);
  const rows = await loadClientAttendance(access.clientId, ym, now);
  const today = ym === currentJstYearMonth(now) ? rows.filter((r) => r.date === todayKey) : [];
  const worked = new Set(rows.filter((r) => r.status === "退勤済み" || r.status === "出勤中").map((r) => `${r.staffName}|${r.date}`)).size;

  return (
    <>
      <ClientAutoRefresh intervalMs={30000} />
      <main className="min-h-dvh bg-[#f4f5f7] text-slate-900">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
          <header className="rounded-[28px] bg-[#14283b] px-6 py-6 text-white shadow-[0_16px_44px_rgba(20,40,59,.2)]">
            <p className="text-[11px] font-black tracking-[.22em] text-slate-300">K.J ATTENDANCE</p>
            <h1 className="mt-1 text-2xl font-black">{access.client.name} 様　出退勤状況</h1>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-300">
              スタッフが勤怠アプリで打刻した時刻を、そのまま表示しています（30秒ごとに自動更新）。時刻はシステムの記録で、スタッフが書き換えることはできません。
            </p>
          </header>

          {today.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-2 text-sm font-black text-slate-500">本日（{dayLabel(todayKey)}）</h2>
              <div className="grid gap-3">
                {today.map((r) => (
                  <article key={r.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-black">{r.staffName}</h3>
                      <StatusBadge row={r} />
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-500">{r.storeName}　予定 {r.plan}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">出勤</p><p className="mt-0.5 text-2xl font-black tabular-nums">{r.clockIn ?? "--:--"}</p></div>
                      <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">退勤</p><p className="mt-0.5 text-2xl font-black tabular-nums">{r.clockOut ?? "--:--"}</p></div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {ym === currentJstYearMonth(now) && today.length === 0 && (
            <p className="mt-5 rounded-3xl bg-white p-5 text-center text-sm font-bold text-slate-400 ring-1 ring-black/5">本日の稼働予定はありません。</p>
          )}

          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-black">{yearMonthLabel(ym)}の記録</h2>
              <nav className="flex items-center gap-2 text-sm font-black">
                <Link href={`/watch/${token}?month=${shiftMonth(ym, -1)}`} className="rounded-xl border px-3 py-1.5">← 前月</Link>
                <Link href={`/watch/${token}?month=${shiftMonth(ym, 1)}`} className="rounded-xl border px-3 py-1.5">翌月 →</Link>
              </nav>
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">出勤・退勤とも打刻済みの日数：{worked}日（スタッフ×日の延べ）</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400"><th className="pb-2">日付</th><th>スタッフ</th><th>店舗</th><th>予定</th><th>出勤</th><th>退勤</th><th>状態</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t align-top">
                      <td className="py-2 font-bold">{dayLabel(r.date)}</td>
                      <td>{r.staffName}</td>
                      <td>{r.storeName}</td>
                      <td className="tabular-nums">{r.plan}</td>
                      <td className="tabular-nums font-bold">{r.clockIn ?? "--:--"}</td>
                      <td className="tabular-nums font-bold">{r.clockOut ?? "--:--"}</td>
                      <td><StatusBadge row={r} /></td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={7} className="py-6 text-center font-bold text-slate-400">この月の記録はありません。</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <p className="mt-4 text-center text-[11px] font-bold text-slate-400">株式会社K.J ／ 表示内容に相違がある場合はK.Jまでご連絡ください。</p>
        </div>
      </main>
    </>
  );
}
