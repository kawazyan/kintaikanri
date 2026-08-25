import { CalendarCheck, Gift } from "lucide-react";
import { yearMonthLabel } from "@/lib/time";
import type { GameState } from "@/lib/game";

export function StampCard({ stamp }: { stamp: GameState["stamp"] }) {
  const remaining = Math.max(0, stamp.targetDays - stamp.completedDays);
  const percent = Math.min(100, Math.round((stamp.completedDays / stamp.targetDays) * 100));

  return (
    <section className="rounded-3xl border border-amber-500/10 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-[0_8px_28px_rgba(0,0,0,0.55)]">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-slate-200">
          <CalendarCheck size={14} className="text-amber-400" />
          今月の勤務スタンプ
        </h2>
        <span className="text-xs text-slate-500">
          目標:{stamp.targetDays}勤務{" "}
          <span className="text-amber-300">達成で{stamp.bonusCoins}コイン</span>
        </span>
      </div>
      <p className="mb-3 text-[11px] text-slate-500">{yearMonthLabel(stamp.yearMonth)}</p>

      <div className="mb-3 grid grid-cols-7 gap-2">
        {stamp.cells.map((cell) => (
          <div
            key={cell.index}
            className={
              cell.state === "stamped"
                ? "flex aspect-square items-center justify-center rounded-full bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 text-[10px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_5px_rgba(220,38,38,0.5)]"
                : cell.state === "today"
                  ? "flex aspect-square animate-pulse items-center justify-center rounded-full border-[1.5px] border-dashed border-red-400 text-[10px] font-bold text-red-400"
                  : "flex aspect-square items-center justify-center rounded-full border-[1.5px] border-slate-700/80 bg-slate-900/40 text-[10px] text-slate-600"
            }
          >
            {cell.state === "stamped" ? "✓" : cell.index + 1}
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-lg font-black text-white">
          {stamp.completedDays}
          <span className="text-xs font-medium text-slate-500">/{stamp.targetDays}勤務達成</span>
        </span>
        <span className="text-xs font-semibold text-slate-300">
          {stamp.bonusAwarded ? "達成!" : `あと${remaining}勤務でボーナス!`}
        </span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-950 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#e0272e] via-red-500 to-amber-400 shadow-[0_0_6px_rgba(220,38,38,0.6)]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="relative flex items-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-b from-red-500/15 to-red-900/10 px-3 py-2.5 ring-1 ring-red-500/20">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.5)]">
          <Gift size={17} className="text-amber-950" />
        </span>
        <p className="text-xs leading-relaxed text-slate-300">
          {stamp.targetDays}勤務達成で{" "}
          <span className="font-bold text-amber-300">ボーナスコイン +{stamp.bonusCoins}</span>{" "}
          獲得!
        </p>
      </div>
    </section>
  );
}
