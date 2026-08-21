import { yearMonthLabel } from "@/lib/time";
import type { GameState } from "@/lib/game";

export function StampCard({ stamp }: { stamp: GameState["stamp"] }) {
  const remaining = Math.max(0, stamp.targetDays - stamp.completedDays);
  const percent = Math.min(100, Math.round((stamp.completedDays / stamp.targetDays) * 100));

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-blue-400/80 uppercase">
          今月のスタンプカード
        </h2>
        <span className="text-sm font-bold text-red-400">
          {stamp.completedDays}
          <span className="text-xs font-medium text-slate-500">/{stamp.targetDays}日</span>
        </span>
      </div>
      <p className="mb-3 text-[11px] text-slate-500">{yearMonthLabel(stamp.yearMonth)}</p>

      <div className="mb-3 grid grid-cols-7 gap-2">
        {stamp.cells.map((cell) => (
          <div
            key={cell.index}
            className={
              cell.state === "stamped"
                ? "flex aspect-square items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-[#e0272e] text-[10px] font-bold text-white shadow shadow-red-950/40"
                : cell.state === "today"
                  ? "flex aspect-square animate-pulse items-center justify-center rounded-full border-[1.5px] border-dashed border-red-400 text-[10px] font-bold text-red-400"
                  : "flex aspect-square items-center justify-center rounded-full border-[1.5px] border-slate-700 text-[10px] text-slate-600"
            }
          >
            {cell.state === "stamped" ? "✓" : cell.index + 1}
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#e0272e] to-red-400"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs font-semibold whitespace-nowrap text-slate-300">
          {stamp.bonusAwarded ? "達成!" : `あと${remaining}日`}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e0272e] text-sm text-white">
          🎁
        </span>
        <p className="text-xs leading-relaxed text-slate-300">
          {stamp.targetDays}日達成で{" "}
          <span className="font-bold text-red-400">ボーナスコイン +{stamp.bonusCoins}</span>{" "}
          獲得!
        </p>
      </div>
    </section>
  );
}
