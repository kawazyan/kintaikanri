import Link from "next/link";
import { Crown, Flame, Coins, ChevronRight, Gem, Plus } from "lucide-react";
import { TITLE_DEFINITIONS } from "@/lib/game-config";
import type { GameState } from "@/lib/game";

const HEX_CLIP = "[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]";

export function GamePanel({ game }: { game: GameState }) {
  const xpPercent =
    game.xpForNextLevel > 0 ? Math.round((game.xpIntoLevel / game.xpForNextLevel) * 100) : 0;

  const achievedCodes = new Set(game.titles.map((t) => t.code));
  const highestTitleDef = [...TITLE_DEFINITIONS].reverse().find((d) => achievedCodes.has(d.code));
  const highestTitle = highestTitleDef
    ? game.titles.find((t) => t.code === highestTitleDef.code)
    : null;
  const nextTitle = game.lockedTitles[0];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-amber-500/10 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-[0_8px_28px_rgba(0,0,0,0.55)]">
      {/* Level badge + current title ribbon */}
      <div className="mb-3 flex items-center gap-3">
        <div className={`relative h-[4.5rem] w-16 shrink-0`}>
          <div
            className={`absolute inset-0 ${HEX_CLIP} bg-gradient-to-b from-amber-100 via-amber-500 to-amber-700 shadow-[0_2px_12px_rgba(245,158,11,0.5)]`}
          />
          <div
            className={`absolute inset-[3px] ${HEX_CLIP} bg-gradient-to-b from-slate-800 via-slate-900 to-black`}
          />
          <div
            className={`absolute inset-[3px] flex flex-col items-center justify-center ${HEX_CLIP} bg-[radial-gradient(circle_at_50%_20%,rgba(245,158,11,0.22),transparent_65%)]`}
          >
            <span className="text-[8px] font-bold tracking-wide text-amber-300">Lv.</span>
            <span className="text-xl leading-none font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
              {game.level}
            </span>
          </div>
        </div>

        {highestTitle ? (
          <div className="relative flex flex-1 items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-red-400 via-red-600 to-red-900 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_14px_rgba(220,38,38,0.4)] ring-1 ring-amber-400/40">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
            <div className="relative min-w-0">
              <p className="text-[9px] font-semibold tracking-wide text-red-100/85">現在の称号</p>
              <p className="truncate text-sm font-black tracking-wide text-white">
                {highestTitle.label}
              </p>
            </div>
            <Crown
              size={20}
              className="relative ml-auto shrink-0 text-amber-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
              fill="currentColor"
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
            <p className="text-xs text-slate-500">称号未獲得(連続3勤務で獲得できます)</p>
          </div>
        )}
      </div>

      {/* Streak & coin chips */}
      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <div className="flex items-center gap-2.5 rounded-2xl border border-orange-500/15 bg-gradient-to-b from-slate-800 to-slate-900 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_10px_rgba(0,0,0,0.4)]">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-orange-300 via-orange-500 to-red-600 shadow-[0_0_10px_rgba(249,115,22,0.5)]">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent" />
            <Flame size={17} className="relative text-white" fill="currentColor" />
          </span>
          <div className="min-w-0">
            <p className="text-base leading-none font-black text-white">{game.streak}</p>
            <p className="mt-0.5 truncate text-[10px] text-slate-400">勤務連続</p>
            <p className="truncate text-[9px] text-orange-300/80">連続シフト達成記録!</p>
          </div>
        </div>
        <div className="relative flex items-center gap-2.5 rounded-2xl border border-amber-500/15 bg-gradient-to-b from-slate-800 to-slate-900 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_10px_rgba(0,0,0,0.4)]">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-amber-100 via-amber-400 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.5)]">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/50 to-transparent" />
            <Coins size={17} className="relative text-amber-950" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base leading-none font-black text-white">
              {game.coins.toLocaleString("ja-JP")}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">コイン</p>
          </div>
          <Link
            href="/my-room"
            className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-b from-amber-200 to-amber-500 shadow-[0_1px_4px_rgba(245,158,11,0.6)]"
          >
            <Plus size={12} className="text-amber-950" strokeWidth={3} />
          </Link>
        </div>
      </div>

      {/* EXP bar */}
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[10px] font-bold tracking-wider text-amber-300/90">EXP</span>
        <span className="text-[11px] font-semibold text-slate-300">
          {game.xpIntoLevel} / {game.xpForNextLevel}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-950 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
          style={{ width: `${xpPercent}%` }}
        />
      </div>
      <p className="mt-1 text-center text-[10px] text-slate-500">
        レベル{game.level + 1}まであと{game.xpForNextLevel - game.xpIntoLevel}EXP
      </p>

      {/* Next title teaser */}
      {nextTitle && (
        <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-slate-800/80 to-slate-900/80 px-3 py-2.5">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-b from-indigo-300 via-violet-500 to-purple-800 shadow-[0_0_10px_rgba(139,92,246,0.5)]">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent" />
            <Gem size={16} className="relative text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold tracking-wide text-indigo-300/80 uppercase">
              Next Title
            </p>
            <p className="truncate text-xs font-bold text-slate-200">{nextTitle.label}</p>
          </div>
          <p className="shrink-0 rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-300">
            あと{Math.max(0, nextTitle.minStreak - game.streak)}勤務
          </p>
        </div>
      )}

      {game.perfectAttendanceThisMonth && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-1.5 text-center text-xs font-semibold text-amber-300">
          🏆 今月の皆勤賞を達成しました!
        </p>
      )}

      <Link
        href="/titles"
        className="mt-3 flex items-center justify-center gap-1 text-[11px] font-semibold text-blue-400"
      >
        称号一覧をすべて見る
        <ChevronRight size={12} />
      </Link>
    </section>
  );
}
