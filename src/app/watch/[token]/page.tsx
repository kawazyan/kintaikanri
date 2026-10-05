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
const weekdayOf = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
};
const monthDay = (d: string) => {
  const [, m, day] = d.split("-").map(Number);
  return `${m}/${day}`;
};
const weekdayColor = (d: string) => (weekdayOf(d) === 0 ? "text-rose-500" : weekdayOf(d) === 6 ? "text-sky-600" : "text-slate-400");
const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

// 色は、状態を表すときだけ使う(緑=出勤中 / 黒=退勤済み / 黄=未出勤 / 橙=退勤未打刻 / 赤=欠勤 / 灰=その他)。
const TONE: Record<ViewStatus, { text: string; dot: string }> = {
  出勤前: { text: "text-slate-500", dot: "bg-slate-300" },
  未出勤: { text: "text-amber-600", dot: "bg-amber-400" },
  出勤中: { text: "text-emerald-600", dot: "bg-emerald-500" },
  退勤済み: { text: "text-slate-700", dot: "bg-slate-800" },
  退勤未打刻: { text: "text-orange-600", dot: "bg-orange-400" },
  欠勤: { text: "text-rose-600", dot: "bg-rose-500" },
  キャンセル: { text: "text-slate-400", dot: "bg-slate-300" },
};

function StatusText({ row }: { row: ViewRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-bold">
      <span className={`inline-flex items-center gap-1.5 ${TONE[row.status].text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${TONE[row.status].dot} ${row.status === "出勤中" ? "animate-pulse" : ""}`} />
        {row.status}
      </span>
      {row.notes.filter((n) => n.label !== row.status).map((n) => (
        <span key={n.label} className="rounded border border-rose-200 px-1.5 text-[11px] font-bold text-rose-600">{n.label}</span>
      ))}
    </span>
  );
}

function Reasons({ row }: { row: ViewRow }) {
  const items = row.notes.filter((n) => n.reason);
  if (!items.length) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {items.map((n) => <p key={n.label} className="text-[11px] text-slate-500">{n.label}の理由：{n.reason}</p>)}
    </div>
  );
}

function Time({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="text-right">
      <p className="text-[10px] font-bold tracking-wider text-slate-400">{label}</p>
      <p className={`text-lg font-semibold tabular-nums leading-tight ${value ? "text-slate-900" : "text-slate-300"}`}>{value ?? "--:--"}</p>
    </div>
  );
}

function AttendanceRow({ row }: { row: ViewRow }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className={`h-10 w-1 shrink-0 rounded-full ${TONE[row.status].dot}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-slate-900">{row.staffName}</p>
        <p className="truncate text-xs text-slate-500">{row.storeName}　{row.plan}</p>
        <div className="mt-1"><StatusText row={row} /></div>
        <Reasons row={row} />
      </div>
      <div className="flex shrink-0 gap-5">
        <Time label="出勤" value={row.clockIn} />
        <Time label="退勤" value={row.clockOut} />
      </div>
    </div>
  );
}

function resultTone(result: string) {
  return result.includes("承認") ? "text-emerald-600" : result.includes("却下") ? "text-rose-600" : "text-amber-600";
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
  const hasNote = (r: ViewRow, label: string) => r.notes.some((n) => n.label === label);
  const matchStatus = (r: ViewRow, key: string) => {
    switch (key) {
      case "WORKED": return r.status === "退勤済み" || r.status === "出勤中" || r.status === "退勤未打刻"; // 出勤済(出勤を打刻した日)
      case "ABSENT": return r.status === "欠勤" || hasNote(r, "欠勤");
      case "LATE": return hasNote(r, "遅刻");
      case "EARLY": return hasNote(r, "早退");
      case "NOT_IN": return r.status === "未出勤";
      case "NO_OUT": return r.status === "退勤未打刻";
      case "CANCELLED": return r.status === "キャンセル";
      default: return true;
    }
  };
  const shown = rows.filter((r) => (!staffFilter || r.staffName === staffFilter) && matchStatus(r, statusFilter));
  const filtered = !!staffFilter || !!statusFilter;
  const href = (over: { month?: string; status?: string }) => {
    const q = new URLSearchParams({ month: over.month ?? ym });
    if (staffFilter) q.set("staff", staffFilter);
    const st = over.status ?? statusFilter;
    if (st) q.set("status", st);
    return `/watch/${token}?${q.toString()}`;
  };

  // 日付ごとにまとめる(新しい日が上)
  const groups = [...new Set(shown.map((r) => r.date))].sort().reverse().map((date) => ({ date, items: shown.filter((r) => r.date === date) }));

  // 上のサマリー(その月の全体。絞り込みの影響を受けない)
  const countOf = (key: string) => rows.filter((r) => matchStatus(r, key)).length;
  const chips: { key: string; label: string }[] = [
    { key: "", label: "すべて" },
    { key: "WORKED", label: "出勤済" },
    { key: "ABSENT", label: "欠勤" },
    { key: "LATE", label: "遅刻" },
    { key: "EARLY", label: "早退" },
    { key: "NOT_IN", label: "未出勤" },
  ];
  const field = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";
  const card = "overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,.06),0_8px_24px_rgba(15,23,42,.05)] ring-1 ring-slate-900/5";
  const sectionTitle = "text-[11px] font-bold tracking-[.2em] text-slate-400";

  return (
    <>
      <ClientAutoRefresh intervalMs={30000} />
      <main className="min-h-dvh bg-[#f5f6f8] pb-10 text-slate-900">
        {/* ヘッダー */}
        <header className="bg-[#0f1b2d] pb-20 pt-7 text-white">
          <div className="mx-auto max-w-2xl px-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold tracking-[.3em] text-slate-400">K.J ATTENDANCE</p>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                LIVE
              </span>
            </div>
            <h1 className="mt-6 text-[26px] font-bold leading-tight tracking-tight">{access.client.name}<span className="ml-1 text-base font-medium text-slate-400">様</span></h1>
            <p className="mt-1 text-sm text-slate-400">出退勤状況　{yearMonthLabel(ym)}</p>
          </div>
        </header>

        <div className="mx-auto -mt-12 max-w-2xl px-4">
          {/* サマリー */}
          <section className={`${card} grid grid-cols-4 divide-x divide-slate-100`}>
            {[
              { label: "出勤済", sub: "延べ", value: worked, dot: "bg-slate-800" },
              { label: "欠勤", sub: "", value: countOf("ABSENT"), dot: "bg-rose-500" },
              { label: "遅刻", sub: "", value: countOf("LATE"), dot: "bg-amber-400" },
              { label: "早退", sub: "", value: countOf("EARLY"), dot: "bg-orange-400" },
            ].map((s) => (
              <div key={s.label} className="px-2 py-4 text-center">
                <p className="flex items-center justify-center gap-1 whitespace-nowrap text-[10px] font-bold text-slate-500 sm:gap-1.5 sm:text-[11px]">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                  {s.label}{s.sub && <span className="font-medium text-slate-400">({s.sub})</span>}
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums leading-none">{s.value}</p>
              </div>
            ))}
          </section>

          {/* 本日 */}
          {today.length > 0 && (
            <section className="mt-8">
              <h2 className={`${sectionTitle} mb-2 px-1`}>TODAY　{monthDay(todayKey)}（{WEEKDAYS[weekdayOf(todayKey)]}）</h2>
              <div className={`${card} divide-y divide-slate-100`}>
                {today.map((r) => <AttendanceRow key={r.id} row={r} />)}
              </div>
            </section>
          )}
          {ym === currentJstYearMonth(now) && today.length === 0 && (
            <p className="mt-8 rounded-2xl bg-white py-4 text-center text-sm text-slate-400 ring-1 ring-slate-900/5">本日の稼働予定はありません。</p>
          )}

          {/* 月の記録 */}
          <section className="mt-9">
            <div className="flex items-end justify-between px-1">
              <h2 className="text-lg font-bold tracking-tight">{yearMonthLabel(ym)}の記録</h2>
              <nav className="flex items-center gap-4 text-sm font-bold text-slate-500">
                <Link href={href({ month: shiftMonth(ym, -1) })} className="hover:text-slate-900">← 前月</Link>
                <Link href={href({ month: shiftMonth(ym, 1) })} className="hover:text-slate-900">翌月 →</Link>
              </nav>
            </div>

            {/* 状態の切り替え */}
            <div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max gap-2">
                {chips.map((c) => {
                  const active = statusFilter === c.key;
                  return (
                    <Link
                      key={c.key || "all"}
                      href={href({ status: c.key })}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${active ? "bg-[#0f1b2d] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"}`}
                    >
                      {c.label}
                      {c.key && <span className={`ml-1.5 tabular-nums ${active ? "text-slate-300" : "text-slate-400"}`}>{countOf(c.key)}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* 月・スタッフ・状態の絞り込み */}
            <form method="get" action={`/watch/${token}`} className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <label className="flex flex-col gap-1">月<input type="month" name="month" defaultValue={ym} className={field} /></label>
              <label className="flex flex-col gap-1">スタッフ
                <select name="staff" defaultValue={staffFilter} className={field}>
                  <option value="">全員</option>
                  {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">状態
                <select name="status" defaultValue={statusFilter} className={field}>
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
              <div className="flex items-end gap-3">
                <button type="submit" className="rounded-lg bg-[#0f1b2d] px-5 py-2 text-sm font-bold text-white">絞り込み</button>
                {filtered && <Link href={`/watch/${token}?month=${ym}`} className="py-2 text-sm font-bold text-slate-500 underline">解除</Link>}
              </div>
            </form>
            <p className="mt-3 px-1 text-xs text-slate-500">
              {filtered ? `該当 ${shown.length}件（この月の全${rows.length}件のうち）` : `全${rows.length}件`}　／　出勤・退勤とも打刻済みの日数：{worked}日（スタッフ×日の延べ）
            </p>

            {/* 記録(日付ごと) */}
            <div className="mt-3 space-y-5">
              {groups.map((g) => (
                <div key={g.date}>
                  <h3 className="mb-1.5 flex items-baseline gap-2 px-1">
                    <span className="text-base font-bold tabular-nums">{monthDay(g.date)}</span>
                    <span className={`text-xs font-bold ${weekdayColor(g.date)}`}>{WEEKDAYS[weekdayOf(g.date)]}</span>
                    <span className="text-[11px] text-slate-400">{g.items.length}件</span>
                  </h3>
                  <div className={`${card} divide-y divide-slate-100`}>
                    {g.items.map((r) => <AttendanceRow key={r.id} row={r} />)}
                  </div>
                </div>
              ))}
              {!groups.length && (
                <p className="rounded-2xl bg-white py-8 text-center text-sm text-slate-400 ring-1 ring-slate-900/5">
                  {filtered ? "条件に合う記録はありません。" : "この月の記録はありません。"}
                </p>
              )}
            </div>
          </section>

          {/* シフト変更の履歴 */}
          <section className="mt-10">
            <h2 className="px-1 text-lg font-bold tracking-tight">シフト変更の履歴</h2>
            <p className="mt-0.5 px-1 text-xs text-slate-500">{yearMonthLabel(ym)}の勤務について、スタッフ側で行った申請・変更です。</p>
            <ul className={`${card} mt-3 divide-y divide-slate-100`}>
              {changes.map((c) => (
                <li key={c.id} className="px-4 py-3.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-bold">{c.staffName}</span>
                    <span className="text-sm text-slate-700">{c.title}</span>
                    {c.result && <span className={`text-xs font-bold ${resultTone(c.result)}`}>{c.result}</span>}
                    <span className="ml-auto text-xs tabular-nums text-slate-400">{toJstDateValue(c.at).slice(5).replace("-", "/")} {toJstTimeValue(c.at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">{c.detail}</p>
                  {c.reason && <p className="mt-0.5 text-xs text-slate-500">理由：{c.reason}</p>}
                </li>
              ))}
              {!changes.length && <li className="py-6 text-center text-sm text-slate-400">この月のシフト変更の履歴はありません。</li>}
            </ul>
          </section>

          <p className="mt-10 text-center text-[11px] text-slate-400">株式会社K.J ／ 表示内容に相違がある場合はK.Jまでご連絡ください。</p>
        </div>
      </main>
    </>
  );
}
