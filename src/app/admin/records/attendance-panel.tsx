import type { StaffAttendanceDetail } from "@/lib/staff-month-summary";

const md = (key: string) => {
  const [, m, d] = key.split("-").map(Number);
  return `${m}/${d}`;
};

type Tone = "ok" | "warn" | "bad";

function Card({ label, note, count, dates, tone }: { label: string; note: string; count: number; dates?: string[]; tone: Tone }) {
  const color =
    count === 0 ? "text-slate-500" : tone === "bad" ? "text-red-300" : tone === "warn" ? "text-amber-300" : "text-emerald-300";
  const border = count === 0 ? "border-slate-800" : tone === "bad" ? "border-red-500/40" : tone === "warn" ? "border-amber-500/40" : "border-emerald-500/40";
  return (
    <div className={`rounded-xl border ${border} bg-slate-950/40 p-3`}>
      <div className="text-xs font-medium text-slate-300">{label}</div>
      <div className={`mt-1 text-2xl font-bold leading-none ${color}`}>
        {count}
        <span className="ml-1 text-xs font-medium text-slate-500">{label === "出勤日数" ? "日" : "件"}</span>
      </div>
      <div className="mt-1 text-[10px] leading-tight text-slate-500">{note}</div>
      {dates && dates.length > 0 && <div className="mt-1.5 text-[11px] leading-snug text-slate-300">{dates.map(md).join("・")}</div>}
    </div>
  );
}

export function AttendancePanel({ staffName, monthLabel, detail }: { staffName: string; monthLabel: string; detail: StaffAttendanceDetail }) {
  return (
    <section className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-200">
        {staffName}さんの{monthLabel}の勤怠
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="出勤日数" note="出勤・退勤の両方を打刻した日" count={detail.workDays} tone="ok" />
        <Card label="打刻漏れ" note="片方だけ／シフトがあるのに打刻なし" count={detail.missedClockDates.length} dates={detail.missedClockDates} tone="warn" />
        <Card label="定時超過打刻" note="シフト開始より遅く出勤打刻" count={detail.lateClockInDates.length} dates={detail.lateClockInDates} tone="warn" />
        <Card label="欠勤" note="欠勤の申請があった日" count={detail.absenceDates.length} dates={detail.absenceDates} tone="bad" />
        <Card label="遅刻(申請)" note="遅刻の申請があった日" count={detail.lateReportDates.length} dates={detail.lateReportDates} tone="warn" />
        <Card label="早退(申請)" note="早退の申請があった日" count={detail.earlyLeaveDates.length} dates={detail.earlyLeaveDates} tone="warn" />
      </div>
    </section>
  );
}
