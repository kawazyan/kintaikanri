import Link from "next/link";
import { Crown, Flame, Coins, ChevronRight, Star, Plus } from "lucide-react";
import { TITLE_DEFINITIONS } from "@/lib/game-config";
import type { GameState } from "@/lib/game";

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
    <section
      className="relative overflow-hidden rounded-t-3xl px-3 pt-2.5 pb-2"
      style={{
        background:
          "linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.9) 100%), #9C2B24",
      }}
    >
      {/* Level badge + current title */}
      <div className="mb-1.5 flex items-center gap-2">
        <div className="relative flex h-[58px] w-[54px] shrink-0 items-center justify-center">
          <svg viewBox="0 0 100 108" className="absolute inset-0 h-full w-full">
            <polygon
              points="50,2 95,27 95,81 50,106 5,81 5,27"
              fill="#14181f"
              stroke="url(#lvGoldGrad)"
              strokeWidth={2.5}
            />
            <defs>
              <linearGradient id="lvGoldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FBE3A4" />
                <stop offset="100%" stopColor="#C98A2E" />
              </linearGradient>
            </defs>
          </svg>
          <div className="relative text-center text-white">
            <div className="text-[8px] tracking-wide opacity-85">Lv.</div>
            <div className="text-[18px] leading-none font-bold">{game.level}</div>
          </div>
        </div>

        <div className="flex-1 pt-0.5">
          <p className="text-[9px] text-white/55">現在の称号</p>
          {highestTitle ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[21px] font-extrabold tracking-[0.01em] text-[#D8D5D2]">
                {highestTitle.label}
              </span>
              <Crown size={15} className="text-amber-300/80" fill="currentColor" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 opacity-60">
              <Crown size={15} className="text-white/40" />
              <span className="text-[13px] font-semibold text-white/40">称号未獲得</span>
            </div>
          )}
        </div>
      </div>

      {/* Streak & coin cards */}
      <div className="mb-2 grid grid-cols-2 gap-2">
        <div className="relative flex items-center gap-2 overflow-hidden rounded-[10px] bg-gradient-to-b from-[#9C2B24] from-25% to-[rgba(0,0,0,0.92)] px-2.5 py-[7px]">
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#FFB067,#E7302E)]">
            <Flame size={12} className="text-white" fill="currentColor" />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] leading-[1.1] font-extrabold text-white">{game.streak}</p>
            <p className="text-[9.5px] text-white">勤務連続</p>
            <p className="truncate text-[8px] text-white/75">連続シフト達成記録!</p>
          </div>
        </div>

        <div className="relative flex items-center gap-2 overflow-hidden rounded-[10px] bg-gradient-to-b from-white from-55% to-[rgba(0,0,0,0.15)] px-2.5 py-[7px]">
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#FFE59A,#F2B84B)]">
            <Coins size={12} className="text-amber-950" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] leading-[1.1] font-extrabold text-[#1c1e26]">
              {game.coins.toLocaleString("ja-JP")}
            </p>
            <p className="text-[9.5px] text-[#7a7f8c]">コイン</p>
          </div>
          <Link
            href="/my-room"
            className="ml-auto flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-[#F2B84B] text-white"
          >
            <Plus size={10} strokeWidth={3} />
          </Link>
        </div>
      </div>

      {/* EXP bar */}
      <div className="flex items-center gap-3 rounded-lg bg-black/60 px-3 py-1.5">
        <span className="shrink-0 text-[12px] font-extrabold text-white">EXP</span>
        <div className="flex-1">
          <div className="h-[6px] overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FF6B5B] to-[#E7302E]"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-[14px] font-extrabold text-white">
          {game.xpIntoLevel} / {game.xpForNextLevel}
        </span>
      </div>
      <p className="mt-[5px] text-center text-[9px] text-white/50">
        レベル{game.level + 1}まであと{game.xpForNextLevel - game.xpIntoLevel}EXP
      </p>

      {/* Next title teaser */}
      {nextTitle && (
        <div className="mt-2 flex items-center gap-2.5 rounded-lg bg-black/40 px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-amber-300 via-orange-500 to-amber-700">
            <Star size={14} className="text-white" fill="currentColor" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold tracking-wide text-white/50 uppercase">
              Next Title
            </p>
            <p className="truncate text-xs font-bold text-white/80">{nextTitle.label}</p>
          </div>
          <p className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold text-amber-300">
            あと{Math.max(0, nextTitle.minStreak - game.streak)}勤務
          </p>
        </div>
      )}

      {game.perfectAttendanceThisMonth && (
        <p className="mt-2 rounded-lg bg-black/40 px-3 py-1.5 text-center text-xs font-semibold text-amber-300">
          🏆 今月の皆勤賞を達成しました!
        </p>
      )}

      <Link
        href="/titles"
        className="mt-2 flex items-center justify-center gap-1 text-[11px] font-semibold text-white/50"
      >
        称号一覧をすべて見る
        <ChevronRight size={12} />
      </Link>
    </section>
  );
}
