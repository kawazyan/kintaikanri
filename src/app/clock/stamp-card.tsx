import { CalendarCheck, Gift } from "lucide-react";
import { yearMonthLabel } from "@/lib/time";
import type { GameState } from "@/lib/game";

export function StampCard({ stamp }: { stamp: GameState["stamp"] }) {
  const remaining = Math.max(0, stamp.targetDays - stamp.completedDays);
  const percent = Math.min(100, Math.round((stamp.completedDays / stamp.targetDays) * 100));

  return (
    <section className="rounded-3xl bg-gradient-to-b from-white to-slate-100 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-red-600 uppercase">
          <CalendarCheck size={14} className="text-red-500" />
          今月の勤務スタンプ
        </h2>
        <span className="text-xs text-slate-500">
          目標:{stamp.targetDays}勤務{" "}
          <span className="font-semibold text-amber-600">達成で{stamp.bonusCoins}コイン</span>
        </span>
      </div>
      <p className="mb-3 text-[11px] text-slate-400">{yearMonthLabel(stamp.yearMonth)}</p>

      <div className="mb-3 grid grid-cols-7 gap-2">
        {stamp.cells.map((cell) => (
          <div
            key={cell.index}
            className={
              cell.state === "stamped"
                ? "flex aspect-square items-center justify-center rounded-full bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 text-[10px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_5px_rgba(220,38,38,0.5)]"
                : cell.state === "today"
                  ? "flex aspect-square animate-pulse items-center justify-center rounded-full border-[1.5px] border-dashed border-red-400 text-[10px] font-bold text-red-400"
                  : "flex aspect-square items-center justify-center rounded-full border-[1.5px] border-slate-200 bg-white text-[10px] text-slate-400"
            }
          >
            {cell.state === "stamped" ? "✓" : cell.index + 1}
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-lg font-black text-slate-900">
          {stamp.completedDays}
          <span className="text-xs font-medium text-slate-500">/{stamp.targetDays}勤務達成</span>
        </span>
        <span className="text-xs font-semibold text-slate-600">
          {stamp.bonusAwarded ? "達成!" : `あと${remaining}勤務でボーナス!`}
        </span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#e0272e] via-red-500 to-amber-400 shadow-[0_0_6px_rgba(220,38,38,0.6)]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="relative flex items-center gap-2.5 overflow-hidden rounded-2xl bg-red-50 px-3 py-2.5 ring-1 ring-red-100">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.5)]">
          <Gift size={17} className="text-amber-950" />
        </span>
        <p className="text-xs leading-relaxed text-slate-600">
          {stamp.targetDays}勤務達成で{" "}
          <span className="font-bold text-red-600">ボーナスコイン +{stamp.bonusCoins}</span>{" "}
          獲得!
        </p>
      </div>
    </section>
  );
}
