import { CalendarDays, Gift, Check, Star } from "lucide-react";
import { yearMonthLabel } from "@/lib/time";
import type { GameState } from "@/lib/game";

export function StampCard({ stamp }: { stamp: GameState["stamp"] }) {
  const remaining = Math.max(0, stamp.targetDays - stamp.completedDays);
  const percent = stamp.targetDays > 0
    ? Math.min(100, Math.round((stamp.completedDays / stamp.targetDays) * 100))
    : 0;

  return (
    <section className="game-hud-frame game-cut-card rounded-[24px] px-4 py-4 text-white">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-[17px] font-black">
            <CalendarDays size={19} strokeWidth={2.5} />
            {yearMonthLabel(stamp.yearMonth)}の勤務スタンプ
          </h2>
        </div>
        <p className="pt-1 text-right text-[10px] font-semibold text-slate-500">
          今月の目標：{stamp.targetDays}勤務<br />
          <span className="text-red-600">🎁 達成で {stamp.bonusCoins}コイン</span>
        </p>
      </div>

      <div className="my-4 grid grid-cols-10 gap-x-2 gap-y-2.5">
        {stamp.cells.map((cell) => {
          const isMilestone = (cell.index + 1) % 5 === 0;
          if (cell.state === "stamped") {
            return (
              <div
                key={cell.index}
                aria-label={`${cell.index + 1}勤務目・達成`}
                className={
                  isMilestone
                    ? "relative aspect-square rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 shadow-[inset_0_1px_2px_rgba(255,255,255,.7),inset_0_-2px_3px_rgba(146,64,14,.35),0_0_9px_rgba(245,158,11,.55)] ring-2 ring-amber-200/60"
                    : "relative aspect-square rounded-full bg-gradient-to-b from-red-400 via-red-500 to-red-700 shadow-[inset_0_1px_2px_rgba(255,255,255,.55),inset_0_-2px_3px_rgba(127,29,29,.4),0_2px_7px_rgba(239,68,68,.4)] ring-2 ring-red-300/40"
                }
              >
                {isMilestone ? (
                  <Star size={12} strokeWidth={2.5} fill="currentColor" className="absolute inset-0 m-auto text-white drop-shadow-[0_1px_1px_rgba(0,0,0,.35)]" />
                ) : (
                  <Check size={12} strokeWidth={3.5} className="absolute inset-0 m-auto text-white drop-shadow-[0_1px_1px_rgba(0,0,0,.35)]" />
                )}
              </div>
            );
          }
          return (
            <div
              key={cell.index}
              aria-label={`${cell.index + 1}勤務目`}
              className={
                cell.state === "today"
                  ? "relative aspect-square rounded-full border-2 border-dashed border-red-500 bg-[#111b24] shadow-[0_0_6px_rgba(239,68,68,.35)]"
                  : "aspect-square rounded-full border-2 border-slate-600 bg-[#0c151e]"
              }
            >
              {cell.state === "today" && (
                <span className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,.8)]" />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-end justify-between gap-2">
        <p className="text-[26px] font-black leading-none text-red-600">
          {stamp.completedDays}
          <span className="ml-1 text-[14px] font-black text-white">/ {stamp.targetDays} 勤務達成</span>
        </p>
        <p className="text-right text-[12px] font-black text-slate-200">
          {stamp.bonusAwarded ? "目標達成!" : `あと ${remaining} 勤務でボーナス!`}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/50">
          <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-600" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-[11px] font-black text-slate-200">{percent}%</span>
      </div>

      {stamp.bonusAwarded && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
          <Gift size={16} /> ボーナスコイン獲得済み
        </div>
      )}
    </section>
  );
}
