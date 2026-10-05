import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientAutoRefresh } from "@/app/client/components/auto-refresh";
import { findActiveViewToken, loadClientAttendance, loadClientShiftChanges, normalizeYearMonth, type ViewRow, type ViewStatus } from "@/lib/client-view";
import { currentJstYearMonth, toJstDateValue, toJstTimeValue, yearMonthLabel } from "@/lib/time";

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
      {row.notes.map((n) => <span key={n.label} className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-black text-rose-800">{n.label}</span>)}
    </span>
  );
}

function Reasons({ row }: { row: ViewRow }) {
  const items = row.notes.filter((n) => n.reason);
  if (!items.length) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {items.map((n) => <p key={n.label} className="text-xs font-bold text-slate-500">{n.label}の理由：{n.reason}</p>)}
    </div>
  );
}

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ month?: string; staff?: string; status?: string }>;
}) {
  const { token } = await params;
  const access = await findActiveViewToken(token);
  if (!access) notFound();

  const { month, staff: staffFilter = "", status: statusFilter = "" } = await searchParams;
  const ym = normalizeYearMonth(month);
  const now = new Date();
  const todayKey = toJstDateValue(now);
  const [rows, changes] = await Promise.all([loadClientAttendance(access.clientId, ym, now), loadClientShiftChanges(access.clientId, ym)]);
  const today = ym === currentJstYearMonth(now) ? rows.filter((r) => r.date === todayKey) : [];
  const worked = new Set(rows.filter((r) => r.status === "退勤済み" || r.status === "出勤中").map((r) => `${r.staffName}|${r.date}`)).size;

  // 記録の絞り込み(スタッフ名・状態)。月は上の ym で絞り込み済み。
  const staffNames = [...new Set(rows.map((r) => r.staffName))];
  const shown = rows.filter((r) => {
    if (staffFilter && r.staffName !== staffFilter) return false;
    const has = (label: string) => r.notes.some((n) => n.label === label);
    switch (statusFilter) {
      case "WORKED": return r.status === "退勤済み" || r.status === "出勤中" || r.status === "退勤未打刻"; // 出勤済(出勤を打刻した日)
      case "ABSENT": return r.status === "欠勤" || has("欠勤");
      case "LATE": return has("遅刻");
      case "EARLY": return has("早退");
      case "NOT_IN": return r.status === "未出勤";
      case "NO_OUT": return r.status === "退勤未打刻";
      case "CANCELLED": return r.status === "キャンセル";
      default: return true;
    }
  });
  const filtered = !!staffFilter || !!statusFilter;
  const keep = (m: string) => {
    const q = new URLSearchParams({ month: m });
    if (staffFilter) q.set("staff", staffFilter);
    if (statusFilter) q.set("status", statusFilter);
    return `/watch/${token}?${q.toString()}`;
  };

  return (
    <>
      <ClientAutoRefresh intervalMs={30000} />
      <main className="min-h-dvh bg-[#f4f5f7] text-slate-900">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
          <header className="rounded-[28px] bg-[#14283b] px-6 py-6 text-white shadow-[0_16px_44px_rgba(20,40,59,.2)]">
            <p className="text-[11px] font-black tracking-[.22em] text-slate-300">K.J ATTENDANCE</p>
            <h1 className="mt-1 text-2xl font-black">{access.client.name} 様　出退勤状況</h1>
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
                    <Reasons row={r} />
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
                <Link href={keep(shiftMonth(ym, -1))} className="rounded-xl border px-3 py-1.5">← 前月</Link>
                <Link href={keep(shiftMonth(ym, 1))} className="rounded-xl border px-3 py-1.5">翌月 →</Link>
              </nav>
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">出勤・退勤とも打刻済みの日数：{worked}日（スタッフ×日の延べ）</p>
            <form method="get" action={`/watch/${token}`} className="mt-3 flex flex-wrap items-end gap-2 text-xs font-bold text-slate-500">
              <label className="flex flex-col gap-1">
                月
                <input type="month" name="month" defaultValue={ym} className="rounded-xl border px-2 py-1.5 text-sm text-slate-900" />
              </label>
              <label className="flex flex-col gap-1">
                スタッフ
                <select name="staff" defaultValue={staffFilter} className="rounded-xl border px-2 py-1.5 text-sm text-slate-900">
                  <option value="">全員</option>
                  {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                状態
                <select name="status" defaultValue={statusFilter} className="rounded-xl border px-2 py-1.5 text-sm text-slate-900">
                  <option value="">すべて</option>
                  <option value="WORKED">出勤済（出勤を打刻した日）</option>
                  <option value="ABSENT">欠勤</option>
                  <option value="LATE">遅刻</option>
                  <option value="EARLY">早退</option>
                  <option value="NOT_IN">未出勤</option>
                  <option value="NO_OUT">退勤未打刻</option>
                  <option value="CANCELLED">キャンセル</option>
                </select>
              </label>
              <button type="submit" className="rounded-xl bg-[#14283b] px-4 py-2 text-sm font-black text-white">絞り込み</button>
              {filtered && <Link href={`/watch/${token}?month=${ym}`} className="px-1 py-2 text-sm font-black text-sky-700 underline">絞り込みを解除</Link>}
            </form>
            {filtered && <p className="mt-2 text-xs font-bold text-slate-500">該当 {shown.length}件（この月の全{rows.length}件のうち）</p>}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400"><th className="pb-2">日付</th><th>スタッフ</th><th>店舗</th><th>予定</th><th>出勤</th><th>退勤</th><th>状態</th></tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} className="border-t align-top">
                      <td className="py-2 font-bold">{dayLabel(r.date)}</td>
                      <td>{r.staffName}</td>
                      <td>{r.storeName}</td>
                      <td className="tabular-nums">{r.plan}</td>
                      <td className="tabular-nums font-bold">{r.clockIn ?? "--:--"}</td>
                      <td className="tabular-nums font-bold">{r.clockOut ?? "--:--"}</td>
                      <td><StatusBadge row={r} /><Reasons row={r} /></td>
                    </tr>
                  ))}
                  {!shown.length && <tr><td colSpan={7} className="py-6 text-center font-bold text-slate-400">{filtered ? "条件に合う記録はありません。" : "この月の記録はありません。"}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="text-lg font-black">シフト変更の履歴</h2>
            <p className="mt-1 text-xs font-bold text-slate-400">{yearMonthLabel(ym)}の勤務について、スタッフ側で行った申請・変更です。</p>
            <ul className="mt-3 divide-y">
              {changes.map((c) => (
                <li key={c.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black">{c.staffName}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-black text-slate-700">{c.title}</span>
                    {c.result && <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-black text-sky-800">{c.result}</span>}
                    <span className="ml-auto text-xs font-bold tabular-nums text-slate-400">{toJstDateValue(c.at).slice(5).replace("-", "/")} {toJstTimeValue(c.at)}</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-700">{c.detail}</p>
                  {c.reason && <p className="mt-0.5 text-xs font-bold text-slate-500">理由：{c.reason}</p>}
                </li>
              ))}
              {!changes.length && <li className="py-4 text-center text-sm font-bold text-slate-400">この月のシフト変更の履歴はありません。</li>}
            </ul>
          </section>
          <p className="mt-4 text-center text-[11px] font-bold text-slate-400">株式会社K.J ／ 表示内容に相違がある場合はK.Jまでご連絡ください。</p>
        </div>
      </main>
    </>
  );
}
