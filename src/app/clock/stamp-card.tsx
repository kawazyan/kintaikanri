import { CalendarDays, Gift } from "lucide-react";
import { yearMonthLabel } from "@/lib/time";
import type { GameState } from "@/lib/game";

export function StampCard({ stamp }: { stamp: GameState["stamp"] }) {
  const remaining = Math.max(0, stamp.targetDays - stamp.completedDays);
  const percent = stamp.targetDays > 0
    ? Math.min(100, Math.round((stamp.completedDays / stamp.targetDays) * 100))
    : 0;

  return (
    <section className="rounded-[24px] bg-white px-4 py-4 text-slate-900 shadow-[0_5px_18px_rgba(64,40,30,.14)] ring-1 ring-black/5">
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
        {stamp.cells.map((cell) => (
          <div
            key={cell.index}
            aria-label={`${cell.index + 1}勤務目`}
            className={
              cell.state === "stamped"
                ? "aspect-square rounded-full bg-gradient-to-b from-red-400 to-red-600 shadow-[inset_0_1px_1px_rgba(255,255,255,.5),0_2px_5px_rgba(239,68,68,.24)]"
                : cell.state === "today"
                  ? "aspect-square rounded-full border-2 border-dashed border-red-500 bg-[#111b24]"
                  : "aspect-square rounded-full border-2 border-slate-600 bg-[#0c151e]"
            }
          />
        ))}
      </div>

      <div className="flex items-end justify-between gap-2">
        <p className="text-[26px] font-black leading-none text-red-600">
          {stamp.completedDays}
          <span className="ml-1 text-[14px] font-black text-slate-900">/ {stamp.targetDays} 勤務達成</span>
        </p>
        <p className="text-right text-[12px] font-black text-slate-700">
          {stamp.bonusAwarded ? "目標達成!" : `あと ${remaining} 勤務でボーナス!`}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-600" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-[11px] font-black text-slate-700">{percent}%</span>
      </div>

      {stamp.bonusAwarded && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
          <Gift size={16} /> ボーナスコイン獲得済み
        </div>
      )}
    </section>
  );
}
