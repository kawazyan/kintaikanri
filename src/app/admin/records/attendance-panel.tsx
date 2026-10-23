import type { StaffAttendanceDetail } from "@/lib/staff-month-summary";

// 管理画面は明るい配色(.admin-theme)。暗い配色用のクラス(text-*-300 / bg-slate-950/40 など)は
// 白背景だと薄くて読めないので、ここでは濃い色を直接指定する。

const md = (key: string) => {
  const [, m, d] = key.split("-").map(Number);
  return `${m}/${d}`;
};

type Tone = "ok" | "warn" | "bad";

const TONE_CLASS: Record<Tone, { box: string; number: string; dates: string }> = {
  ok: { box: "border-[#34d399] bg-[#ecfdf5]", number: "text-[#047857]", dates: "text-[#065f46]" },
  warn: { box: "border-[#f59e0b] bg-[#fffbeb]", number: "text-[#b45309]", dates: "text-[#92400e]" },
  bad: { box: "border-[#f87171] bg-[#fef2f2]", number: "text-[#b91c1c]", dates: "text-[#991b1b]" },
};
const ZERO_CLASS = { box: "border-[#e2e8f0] bg-[#f8fafc]", number: "text-[#94a3b8]", dates: "" };

function Card({ label, note, count, unit, dates, tone }: { label: string; note: string; count: number; unit: string; dates?: string[]; tone: Tone }) {
  const c = count === 0 ? ZERO_CLASS : TONE_CLASS[tone];
  return (
    <div className={`rounded-xl border-2 p-3 ${c.box}`}>
      <div className="text-sm font-bold text-[#1e293b]">{label}</div>
      <div className={`mt-1 text-3xl font-extrabold leading-none ${c.number}`}>
        {count}
        <span className="ml-1 text-sm font-semibold text-[#64748b]">{unit}</span>
      </div>
      <div className="mt-1.5 text-[11px] leading-tight text-[#64748b]">{note}</div>
      {dates && dates.length > 0 && <div className={`mt-2 text-xs font-semibold leading-snug ${c.dates}`}>{dates.map(md).join("・")}</div>}
    </div>
  );
}

export function AttendancePanel({ staffName, monthLabel, detail }: { staffName: string; monthLabel: string; detail: StaffAttendanceDetail }) {
  return (
    <section className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur-sm">
      <h2 className="mb-3 text-sm font-bold text-[#1e293b]">
        {staffName}さんの{monthLabel}の勤怠
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="出勤日数" note="出勤・退勤の両方を打刻した日" count={detail.workDays} unit="日" tone="ok" />
        <Card label="打刻漏れ" note="片方だけ／シフトがあるのに打刻なし" count={detail.missedClockDates.length} unit="件" dates={detail.missedClockDates} tone="warn" />
        <Card label="定時超過打刻" note="シフト開始より遅く出勤打刻" count={detail.lateClockInDates.length} unit="件" dates={detail.lateClockInDates} tone="warn" />
        <Card label="欠勤" note="欠勤の申請があった日" count={detail.absenceDates.length} unit="件" dates={detail.absenceDates} tone="bad" />
        <Card label="遅刻(申請)" note="遅刻の申請があった日" count={detail.lateReportDates.length} unit="件" dates={detail.lateReportDates} tone="warn" />
        <Card label="早退(申請)" note="早退の申請があった日" count={detail.earlyLeaveDates.length} unit="件" dates={detail.earlyLeaveDates} tone="warn" />
      </div>
    </section>
  );
}
