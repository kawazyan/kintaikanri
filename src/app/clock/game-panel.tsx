import { Crown, Flame, Coins, Plus } from "lucide-react";
import type { GameState } from "@/lib/game";
import { TITLE_DEFINITIONS } from "@/lib/game-config";

export function GamePanel({ game }: { game: GameState }) {
  const xpPercent = game.xpForNextLevel > 0
    ? Math.min(100, Math.round((game.xpIntoLevel / game.xpForNextLevel) * 100))
    : 0;

  const achievedCodes = new Set(game.titles.map((title) => title.code));
  const highestDefinition = [...TITLE_DEFINITIONS]
    .reverse()
    .find((definition) => achievedCodes.has(definition.code));
  const highestTitle = highestDefinition
    ? game.titles.find((title) => title.code === highestDefinition.code)
    : null;

  return (
    <section
      className="relative overflow-hidden rounded-t-[28px] px-3 pb-3 pt-3"
      style={{
        background: "linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.9) 100%), #9C2B24",
      }}
    >

      <div className="relative flex items-center gap-3">
        <div className="relative flex h-[74px] w-[70px] shrink-0 items-center justify-center">
          <svg viewBox="0 0 100 108" className="absolute inset-0 h-full w-full drop-shadow-[0_4px_7px_rgba(0,0,0,.45)]">
            <polygon points="50,2 95,27 95,81 50,106 5,81 5,27" fill="#171a22" stroke="#e0b76a" strokeWidth="3" />
          </svg>
          <div className="relative text-center text-white">
            <div className="text-[10px] font-semibold tracking-wide text-white/70">Lv.</div>
            <div className="text-[27px] font-black leading-none">{game.level}</div>
          </div>
        </div>

        <div className="min-w-0 flex-1 text-center">
          <p className="mb-0.5 text-[10px] font-semibold tracking-[.12em] text-white/45">現在の称号</p>
          {highestTitle ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <p className="truncate text-[24px] font-black tracking-[.025em] text-[#f2d9d2] drop-shadow-sm">
                  {highestTitle.label}
                </p>
                <Crown size={18} className="shrink-0 text-amber-300" fill="currentColor" />
              </div>
              <p className="mt-0.5 text-[10px] font-medium text-white/50">獲得済みタイトル</p>
            </>
          ) : (
            <div className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5">
              <Crown size={12} className="text-slate-300" />
              <p className="text-[11px] text-slate-300">称号未獲得</p>
            </div>
          )}
        </div>
      </div>

      <div className="relative mt-2 grid grid-cols-2 gap-2">
        <div className="flex min-h-[70px] items-center gap-2.5 rounded-[18px] bg-white px-3 py-2.5 text-slate-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,.5),0_3px_10px_rgba(0,0,0,.2)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-300 via-orange-500 to-red-600 shadow-[0_4px_12px_rgba(239,68,68,.3)]">
            <Flame size={22} className="text-white" fill="currentColor" />
          </span>
          <div className="min-w-0">
            <p className="text-[22px] font-black leading-none">{game.streak} <span className="text-sm">勤務連続</span></p>
            <p className="mt-1 text-[10px] font-medium text-slate-500">連続シフト達成記録!</p>
          </div>
        </div>

        <div className="relative flex min-h-[70px] items-center gap-2.5 rounded-[18px] bg-white px-3 py-2.5 text-slate-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,.5),0_3px_10px_rgba(0,0,0,.2)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-100 via-amber-300 to-amber-500 shadow-[0_4px_12px_rgba(245,158,11,.25)]">
            <Coins size={21} className="text-amber-800" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[22px] font-black leading-none">{game.coins.toLocaleString("ja-JP")}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">コイン</p>
          </div>
          <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white shadow-sm">
            <Plus size={13} strokeWidth={3} />
          </span>
        </div>
      </div>

      <div className="relative mt-2 rounded-[17px] border border-white/10 bg-[#171821] px-3 py-2.5 shadow-[inset_0_2px_5px_rgba(0,0,0,.55)]">
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-black text-white">EXP</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full border border-white/15 bg-[#2a2b34] shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-600 shadow-[0_0_10px_rgba(239,68,68,.45)]"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
          <span className="min-w-[68px] text-right text-[14px] font-black tabular-nums text-white">
            {game.xpIntoLevel} / {game.xpForNextLevel}
          </span>
        </div>
        <p className="mt-1 text-center text-[10px] font-medium text-white/50">
          レベル{game.level + 1}まであと{Math.max(0, game.xpForNextLevel - game.xpIntoLevel)}EXP
        </p>
      </div>
    </section>
  );
}
