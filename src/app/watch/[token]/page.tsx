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
const dayLabel = (d: string) => `${monthDay(d)}(${WEEKDAYS[weekdayOf(d)]})`;
const weekdayColor = (d: string) => (weekdayOf(d) === 0 ? "text-rose-500" : weekdayOf(d) === 6 ? "text-sky-600" : "text-slate-500");
const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

// 状態のピル(丸い札)の色。
const PILL: Record<ViewStatus, string> = {
  出勤前: "from-[#9aa8b5] to-[#7d8c9b]",
  未出勤: "from-[#d6ae60] to-[#b58d40]",
  出勤中: "from-[#3fa7ad] to-[#2a808f]",
  退勤済み: "from-[#4f9fb0] to-[#357d93]",
  退勤未打刻: "from-[#e19a55] to-[#c97b33]",
  欠勤: "from-[#7088ad] to-[#516a8f]",
  キャンセル: "from-[#a7b0ba] to-[#8b95a1]",
};
// 記録カードを淡い青緑にする状態(出勤の打刻がある日)。
const ACTIVE = new Set<ViewStatus>(["出勤中", "退勤済み", "退勤未打刻"]);

const AVATAR_TONES = [
  "from-[#7fb8c4] to-[#4f93a6]",
  "from-[#8fa7d0] to-[#5f7fb3]",
  "from-[#c9a5c9] to-[#a47ca8]",
  "from-[#e0b27c] to-[#c58f4f]",
  "from-[#86bf9d] to-[#5a9c78]",
  "from-[#d49a9a] to-[#b87474]",
];
function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const initial = name.trim().charAt(0) || "?";
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-black text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,.55)] ${AVATAR_TONES[hash % AVATAR_TONES.length]}`}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function StatusPill({ row }: { row: ViewRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center rounded-full bg-gradient-to-b px-3 py-0.5 text-xs font-black text-white shadow-sm ${PILL[row.status]}`}>
        {row.status}
      </span>
      {row.notes.filter((n) => n.label !== row.status).map((n) => (
        <span key={n.label} className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-black text-rose-700 ring-1 ring-rose-200">{n.label}</span>
      ))}
    </span>
  );
}

function Reasons({ row }: { row: ViewRow }) {
  const items = row.notes.filter((n) => n.reason);
  if (!items.length) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {items.map((n) => <p key={n.label} className="text-[11px] font-bold text-slate-500">{n.label}の理由：{n.reason}</p>)}
    </div>
  );
}

function ClockTimes({ row }: { row: ViewRow }) {
  return (
    <div className="grid grid-cols-2 gap-4 text-center">
      <div><p className="text-[10px] font-black text-slate-400">出勤</p><p className="text-base font-black tabular-nums text-slate-800">{row.clockIn ?? "--:--"}</p></div>
      <div><p className="text-[10px] font-black text-slate-400">退勤</p><p className="text-base font-black tabular-nums text-slate-800">{row.clockOut ?? "--:--"}</p></div>
    </div>
  );
}

function Stat({ label, value, box, num }: { label: string; value: number; box: string; num: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-b px-3 pb-3 pt-2.5 text-center shadow-[0_8px_20px_rgba(30,60,90,.14)] ring-1 ring-white/70 ${box}`}>
      <p className="whitespace-nowrap text-[10px] font-black text-slate-600 sm:text-[11px]">{label}</p>
      <p className={`mt-0.5 text-3xl font-black tabular-nums leading-none ${num}`}>
        {value}
        <span className="ml-0.5 text-sm font-black">件</span>
      </p>
    </div>
  );
}

function resultTone(result: string) {
  return result.includes("承認") ? "text-[#2a808f]" : result.includes("却下") ? "text-rose-600" : "text-amber-600";
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
  const field = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm";

  return (
    <>
      <ClientAutoRefresh intervalMs={30000} />
      <main className="min-h-dvh bg-[linear-gradient(180deg,#d9e5ec_0%,#e8eef3_28%,#eef2f5_100%)] pb-0 text-slate-900">
        {/* ヘッダー */}
        <header className="bg-[linear-gradient(165deg,#5b9bab_0%,#41829a_48%,#2c6a86_100%)] pb-16 pt-6 text-white">
          <div className="mx-auto max-w-3xl px-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xl font-black tracking-wide text-white/90 sm:text-2xl">K.J ATTENDANCE</p>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-black text-white ring-1 ring-white/30 backdrop-blur">
                LIVE　30秒ごとに自動更新
                <svg width="22" height="12" viewBox="0 0 22 12" fill="none" aria-hidden className="text-white/80">
                  <path d="M1 6h3l2-5 3 10 3-8 2 3h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
            <h1 className="mt-4 text-lg font-black leading-snug text-white sm:text-xl">
              {access.client.name}様 出退勤状況 {yearMonthLabel(ym)}
            </h1>
          </div>
        </header>

        <div className="mx-auto -mt-10 max-w-3xl px-4">
          {/* サマリー */}
          <section className="grid grid-cols-4 gap-2 sm:gap-3">
            <Stat label="出勤済(延べ)" value={worked} box="from-[#e1f3f4] to-[#c4e5e9]" num="text-[#2a808f]" />
            <Stat label="欠勤" value={countOf("ABSENT")} box="from-[#fcefea] to-[#f6dcd3]" num="text-[#b4684f]" />
            <Stat label="遅刻" value={countOf("LATE")} box="from-[#eaeff9] to-[#d6def0]" num="text-[#3d5a8a]" />
            <Stat label="早退" value={countOf("EARLY")} box="from-[#fdf1e2] to-[#f8dfc0]" num="text-[#c07a2c]" />
          </section>

          {/* 本日 */}
          {today.length > 0 && (
            <section className="mt-7">
              <h2 className="mb-2 text-xl font-black text-slate-800">本日 ({dayLabel(todayKey)})</h2>
              <div className="divide-y divide-[#eadfc6] overflow-hidden rounded-2xl bg-[#fbf5e6] shadow-[0_6px_18px_rgba(120,95,40,.12)] ring-1 ring-[#efe3c6]">
                {today.map((r) => (
                  <article key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
                    <div className="flex min-w-0 flex-1 basis-[200px] items-center gap-3">
                      <Avatar name={r.staffName} size={44} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-base font-black">{r.staffName}</span>
                          <StatusPill row={r} />
                        </p>
                        <p className="truncate text-xs font-bold text-slate-500">{r.storeName}</p>
                        <Reasons row={r} />
                      </div>
                    </div>
                    <div className="text-center text-xs font-bold text-slate-500"><span className="block text-[10px] font-black text-slate-400">予定</span><span className="tabular-nums">{r.plan}</span></div>
                    <div className="border-l border-[#e6d9bb] pl-4"><ClockTimes row={r} /></div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {ym === currentJstYearMonth(now) && today.length === 0 && (
            <p className="mt-7 rounded-2xl bg-white/80 p-4 text-center text-sm font-bold text-slate-400 shadow-sm ring-1 ring-black/5">本日の稼働予定はありません。</p>
          )}

          {/* 月の記録 */}
          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-black text-slate-800">{yearMonthLabel(ym)}の記録</h2>
              <nav className="flex items-center gap-4 text-sm font-black text-[#47658a]">
                <Link href={href({ month: shiftMonth(ym, -1) })} className="hover:underline">← 前月</Link>
                <Link href={href({ month: shiftMonth(ym, 1) })} className="hover:underline">翌月 →</Link>
              </nav>
            </div>

            {/* 状態のクイック切り替え */}
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => {
                const active = statusFilter === c.key;
                return (
                  <Link
                    key={c.key || "all"}
                    href={href({ status: c.key })}
                    className={`rounded-full px-3.5 py-1 text-xs font-black transition ${active ? "bg-[#47658a] text-white shadow" : "border border-slate-200 bg-white/90 text-slate-600 hover:bg-white"}`}
                  >
                    {c.label}
                    {c.key && <span className="ml-1 tabular-nums">{countOf(c.key)}</span>}
                  </Link>
                );
              })}
            </div>

            {/* 月・スタッフ・状態の絞り込み */}
            <form method="get" action={`/watch/${token}`} className="mt-4 flex flex-wrap items-end gap-3 text-xs font-black text-slate-600">
              <label className="flex flex-col gap-1">
                月
                <input type="month" name="month" defaultValue={ym} className={field} />
              </label>
              <label className="flex flex-col gap-1">
                スタッフ
                <select name="staff" defaultValue={staffFilter} className={field}>
                  <option value="">全員</option>
                  {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                状態
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
              <button type="submit" className="rounded-xl bg-gradient-to-b from-[#5a79a0] to-[#47658a] px-5 py-2 text-sm font-black text-white shadow-md">絞り込み</button>
              {filtered && <Link href={`/watch/${token}?month=${ym}`} className="px-1 py-2 text-sm font-black text-[#47658a] underline">解除</Link>}
            </form>
            <p className="mt-3 text-xs font-bold text-slate-600">
              {filtered ? `該当 ${shown.length}件（この月の全${rows.length}件のうち）` : `全${rows.length}件`} ／ 出勤・退勤とも打刻済みの日数：{worked}日（スタッフ×日の延べ）
            </p>

            {/* 記録(カード) */}
            <ul className="mt-3 space-y-2.5">
              {shown.map((r) => {
                const active = ACTIVE.has(r.status);
                return (
                  <li key={r.id} className={`flex items-stretch overflow-hidden rounded-2xl shadow-[0_6px_16px_rgba(40,70,100,.1)] ring-1 ring-black/5 ${active ? "bg-[#e1eff0]" : "bg-white"}`}>
                    <div className={`flex w-14 shrink-0 flex-col items-center justify-center py-2 text-center sm:w-16 ${active ? "bg-[#c9e0e3]" : "bg-[#eef2f6]"}`}>
                      <span className="text-base font-black leading-tight tabular-nums text-slate-800">{monthDay(r.date)}</span>
                      <span className={`text-xs font-black ${weekdayColor(r.date)}`}>({WEEKDAYS[weekdayOf(r.date)]})</span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 p-3">
                      <div className="flex min-w-0 flex-1 basis-[130px] items-center gap-2.5">
                        <Avatar name={r.staffName} size={36} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">{r.staffName}</p>
                          <p className="truncate text-xs font-bold text-slate-500">{r.storeName}</p>
                        </div>
                      </div>
                      <div className="space-y-1 text-center">
                        <StatusPill row={r} />
                        <p className="text-[11px] font-bold tabular-nums text-slate-500">{r.plan}</p>
                      </div>
                      <div className="border-l border-slate-200 pl-3"><ClockTimes row={r} /></div>
                      <div className="basis-full empty:hidden"><Reasons row={r} /></div>
                    </div>
                  </li>
                );
              })}
              {!shown.length && (
                <li className="rounded-2xl bg-white/80 py-8 text-center text-sm font-bold text-slate-400 ring-1 ring-black/5">
                  {filtered ? "条件に合う記録はありません。" : "この月の記録はありません。"}
                </li>
              )}
            </ul>
          </section>

          {/* シフト変更の履歴 */}
          <section className="mt-8">
            <h2 className="text-xl font-black text-slate-800">シフト変更の履歴</h2>
            <p className="mt-0.5 text-xs font-bold text-slate-500">{yearMonthLabel(ym)}の勤務について、スタッフ側で行った申請・変更です。</p>
            <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-[0_6px_16px_rgba(40,70,100,.1)] ring-1 ring-black/5">
              {changes.map((c) => (
                <li key={c.id} className="flex items-start gap-3 p-3.5">
                  <Avatar name={c.staffName} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-black">{c.staffName}</span>
                      <span className="text-sm font-black text-slate-700">{c.title}</span>
                      {c.result && <span className={`text-sm font-black ${resultTone(c.result)}`}>（{c.result}）</span>}
                      <span className="ml-auto text-xs font-bold tabular-nums text-slate-500">
                        {toJstDateValue(c.at).replaceAll("-", "/")} {toJstTimeValue(c.at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-bold text-slate-600">{c.detail}</p>
                    {c.reason && <p className="mt-0.5 text-xs font-bold text-slate-500">理由：{c.reason}</p>}
                  </div>
                </li>
              ))}
              {!changes.length && <li className="py-6 text-center text-sm font-bold text-slate-400">この月のシフト変更の履歴はありません。</li>}
            </ul>
          </section>
        </div>

        <footer className="mt-8 bg-[#cfe3e8]/70 py-3 text-center text-[11px] font-bold text-slate-600">
          株式会社K.J ／ 表示内容に相違がある場合はK.Jまでご連絡ください。
        </footer>
      </main>
    </>
  );
}
