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
const dayLabel = (d: string) => {
  const [, m, day] = d.split("-").map(Number);
  return `${m}/${day}(${WEEKDAYS[weekdayOf(d)]})`;
};
const weekdayColor = (d: string) => (weekdayOf(d) === 0 ? "text-rose-500" : weekdayOf(d) === 6 ? "text-sky-500" : "text-slate-400");
const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

// 状態ごとの色(バッジ・ドット・カードの左帯)。
const TONE: Record<ViewStatus, { badge: string; dot: string; bar: string }> = {
  出勤前: { badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400", bar: "bg-slate-300" },
  未出勤: { badge: "bg-amber-100 text-amber-800", dot: "bg-amber-500", bar: "bg-amber-400" },
  出勤中: { badge: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  退勤済み: { badge: "bg-sky-100 text-sky-800", dot: "bg-sky-500", bar: "bg-sky-500" },
  退勤未打刻: { badge: "bg-orange-100 text-orange-800", dot: "bg-orange-500", bar: "bg-orange-400" },
  欠勤: { badge: "bg-rose-100 text-rose-800", dot: "bg-rose-500", bar: "bg-rose-500" },
  キャンセル: { badge: "bg-slate-200 text-slate-500", dot: "bg-slate-400", bar: "bg-slate-300" },
};

function StatusBadge({ row }: { row: ViewRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-black ${TONE[row.status].badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${TONE[row.status].dot} ${row.status === "出勤中" ? "animate-pulse" : ""}`} />
        {row.status}
      </span>
      {row.notes.map((n) => (
        <span key={n.label} className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-black text-rose-700 ring-1 ring-rose-200">{n.label}</span>
      ))}
    </span>
  );
}

function Reasons({ row }: { row: ViewRow }) {
  const items = row.notes.filter((n) => n.reason);
  if (!items.length) return null;
  return (
    <div className="mt-1.5 space-y-0.5">
      {items.map((n) => <p key={n.label} className="text-xs font-bold text-slate-500">{n.label}の理由：{n.reason}</p>)}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(15,34,54,.08)] ring-1 ring-black/5">
      <p className="text-[11px] font-black tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-black tabular-nums leading-none ${tone}`}>
        {value}
        <span className="ml-1 text-sm font-bold text-slate-400">件</span>
      </p>
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

  return (
    <>
      <ClientAutoRefresh intervalMs={30000} />
      <main className="min-h-dvh bg-[#eef1f5] pb-12 text-slate-900">
        {/* ヘッダー */}
        <header className="bg-[linear-gradient(135deg,#0c1d2e_0%,#14283b_45%,#1f4e73_100%)] pb-16 pt-8 text-white">
          <div className="mx-auto max-w-4xl px-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black tracking-[.28em] text-sky-200/80">K.J ATTENDANCE</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-sky-100 ring-1 ring-white/15">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                LIVE　30秒ごとに自動更新
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">{access.client.name}<span className="ml-1 text-xl font-bold text-sky-100/80">様</span></h1>
            <p className="mt-1 text-sm font-bold text-sky-100/70">出退勤状況　{yearMonthLabel(ym)}</p>
          </div>
        </header>

        <div className="mx-auto -mt-10 max-w-4xl px-4">
          {/* サマリー */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="出勤済（延べ）" value={worked} tone="text-sky-600" />
            <Stat label="欠勤" value={countOf("ABSENT")} tone="text-rose-600" />
            <Stat label="遅刻" value={countOf("LATE")} tone="text-amber-600" />
            <Stat label="早退" value={countOf("EARLY")} tone="text-orange-600" />
          </section>

          {/* 本日 */}
          {today.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-600">
                <span className="h-4 w-1 rounded-full bg-sky-500" />本日（{dayLabel(todayKey)}）
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {today.map((r) => (
                  <article key={r.id} className="relative overflow-hidden rounded-3xl bg-white p-5 pl-6 shadow-[0_10px_30px_rgba(15,34,54,.08)] ring-1 ring-black/5">
                    <span className={`absolute inset-y-0 left-0 w-1.5 ${TONE[r.status].bar}`} />
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-lg font-black">{r.staffName}</h3>
                      <StatusBadge row={r} />
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-500">{r.storeName}</p>
                    <p className="text-xs font-bold text-slate-400">予定 {r.plan}</p>
                    <Reasons row={r} />
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-[#f3f6fa] p-3"><p className="text-[11px] font-black tracking-wider text-slate-400">出勤</p><p className="mt-0.5 text-3xl font-black tabular-nums text-slate-800">{r.clockIn ?? "--:--"}</p></div>
                      <div className="rounded-2xl bg-[#f3f6fa] p-3"><p className="text-[11px] font-black tracking-wider text-slate-400">退勤</p><p className="mt-0.5 text-3xl font-black tabular-nums text-slate-800">{r.clockOut ?? "--:--"}</p></div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {ym === currentJstYearMonth(now) && today.length === 0 && (
            <p className="mt-8 rounded-3xl bg-white p-5 text-center text-sm font-bold text-slate-400 shadow-sm ring-1 ring-black/5">本日の稼働予定はありません。</p>
          )}

          {/* 月の記録 */}
          <section className="mt-8 rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(15,34,54,.08)] ring-1 ring-black/5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-black">
                <span className="h-5 w-1 rounded-full bg-sky-500" />{yearMonthLabel(ym)}の記録
              </h2>
              <nav className="flex items-center gap-2 text-sm font-black">
                <Link href={href({ month: shiftMonth(ym, -1) })} className="rounded-full border border-slate-200 px-4 py-1.5 text-slate-600 transition hover:bg-slate-50">← 前月</Link>
                <Link href={href({ month: shiftMonth(ym, 1) })} className="rounded-full border border-slate-200 px-4 py-1.5 text-slate-600 transition hover:bg-slate-50">翌月 →</Link>
              </nav>
            </div>

            {/* 状態のクイック切り替え */}
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((c) => {
                const active = statusFilter === c.key;
                return (
                  <Link
                    key={c.key || "all"}
                    href={href({ status: c.key })}
                    className={`rounded-full px-4 py-1.5 text-xs font-black transition ${active ? "bg-[#14283b] text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {c.label}
                    {c.key && <span className={`ml-1.5 tabular-nums ${active ? "text-sky-200" : "text-slate-400"}`}>{countOf(c.key)}</span>}
                  </Link>
                );
              })}
            </div>

            {/* 月・スタッフ・状態の絞り込み */}
            <form method="get" action={`/watch/${token}`} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-[#f3f6fa] p-3 text-[11px] font-black tracking-wider text-slate-400">
              <label className="flex flex-col gap-1">
                月
                <input type="month" name="month" defaultValue={ym} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold tracking-normal text-slate-900" />
              </label>
              <label className="flex flex-col gap-1">
                スタッフ
                <select name="staff" defaultValue={staffFilter} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold tracking-normal text-slate-900">
                  <option value="">全員</option>
                  {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                状態
                <select name="status" defaultValue={statusFilter} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold tracking-normal text-slate-900">
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
              <button type="submit" className="rounded-xl bg-[#14283b] px-5 py-2 text-sm font-black tracking-normal text-white shadow transition hover:bg-[#1c3a55]">絞り込み</button>
              {filtered && <Link href={`/watch/${token}?month=${ym}`} className="px-1 py-2 text-sm font-black tracking-normal text-sky-700 underline">解除</Link>}
            </form>
            <p className="mt-3 text-xs font-bold text-slate-400">
              {filtered ? `該当 ${shown.length}件（この月の全${rows.length}件のうち）` : `全${rows.length}件`}　／　出勤・退勤とも打刻済みの日数：{worked}日（スタッフ×日の延べ）
            </p>

            {/* スマホ: カード */}
            <ul className="mt-3 space-y-3 md:hidden">
              {shown.map((r) => (
                <li key={r.id} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 pl-5 shadow-sm">
                  <span className={`absolute inset-y-0 left-0 w-1 ${TONE[r.status].bar}`} />
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-black tabular-nums">{dayLabel(r.date).split("(")[0]}<span className={`ml-1 text-xs font-black ${weekdayColor(r.date)}`}>({WEEKDAYS[weekdayOf(r.date)]})</span></p>
                    <StatusBadge row={r} />
                  </div>
                  <p className="mt-1 text-sm font-black">{r.staffName}<span className="ml-2 text-xs font-bold text-slate-400">{r.storeName}</span></p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-[#f3f6fa] py-2"><p className="text-[10px] font-black text-slate-400">予定</p><p className="text-xs font-black tabular-nums text-slate-600">{r.plan}</p></div>
                    <div className="rounded-xl bg-[#f3f6fa] py-2"><p className="text-[10px] font-black text-slate-400">出勤</p><p className="text-base font-black tabular-nums">{r.clockIn ?? "--:--"}</p></div>
                    <div className="rounded-xl bg-[#f3f6fa] py-2"><p className="text-[10px] font-black text-slate-400">退勤</p><p className="text-base font-black tabular-nums">{r.clockOut ?? "--:--"}</p></div>
                  </div>
                  <Reasons row={r} />
                </li>
              ))}
              {!shown.length && <li className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm font-bold text-slate-400">{filtered ? "条件に合う記録はありません。" : "この月の記録はありません。"}</li>}
            </ul>

            {/* PC: 表 */}
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-black tracking-wider text-slate-400">
                    <th className="pb-2 pl-3">日付</th><th>スタッフ</th><th>店舗</th><th>予定</th><th>出勤</th><th>退勤</th><th>状態</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 align-top transition hover:bg-[#f7f9fc]">
                      <td className="py-3 pl-3 font-black tabular-nums">{dayLabel(r.date).split("(")[0]}<span className={`ml-1 text-xs ${weekdayColor(r.date)}`}>({WEEKDAYS[weekdayOf(r.date)]})</span></td>
                      <td className="font-bold">{r.staffName}</td>
                      <td className="text-slate-600">{r.storeName}</td>
                      <td className="tabular-nums text-slate-500">{r.plan}</td>
                      <td className="font-black tabular-nums">{r.clockIn ?? "--:--"}</td>
                      <td className="font-black tabular-nums">{r.clockOut ?? "--:--"}</td>
                      <td><StatusBadge row={r} /><Reasons row={r} /></td>
                    </tr>
                  ))}
                  {!shown.length && <tr><td colSpan={7} className="py-8 text-center font-bold text-slate-400">{filtered ? "条件に合う記録はありません。" : "この月の記録はありません。"}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {/* シフト変更の履歴 */}
          <section className="mt-8 rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(15,34,54,.08)] ring-1 ring-black/5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-black"><span className="h-5 w-1 rounded-full bg-sky-500" />シフト変更の履歴</h2>
            <p className="mt-1 text-xs font-bold text-slate-400">{yearMonthLabel(ym)}の勤務について、スタッフ側で行った申請・変更です。</p>
            <ul className="mt-3 divide-y divide-slate-100">
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
              {!changes.length && <li className="py-6 text-center text-sm font-bold text-slate-400">この月のシフト変更の履歴はありません。</li>}
            </ul>
          </section>

          <p className="mt-6 text-center text-[11px] font-bold text-slate-400">株式会社K.J ／ 表示内容に相違がある場合はK.Jまでご連絡ください。</p>
        </div>
      </main>
    </>
  );
}
