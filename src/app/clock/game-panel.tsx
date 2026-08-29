import { Crown, Flame, Coins } from "lucide-react";
import type { GameState } from "@/lib/game";
import { TITLE_DEFINITIONS } from "@/lib/game-config";

export function GamePanel({ game }: { game: GameState }) {
  const xpPercent = game.xpForNextLevel > 0
    ? Math.min(100, Math.round((game.xpIntoLevel / game.xpForNextLevel) * 100))
    : 0;

  const achievedCodes = new Set(game.titles.map((title) => title.code));
  const highestDefinition = [...TITLE_DEFINITIONS].reverse().find((definition) => achievedCodes.has(definition.code));
  const highestTitle = highestDefinition ? game.titles.find((title) => title.code === highestDefinition.code) : null;

  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(155deg,#10202c_0%,#071019_52%,#120b0d_100%)] px-3 pb-3 pt-3 text-white shadow-[inset_0_-12px_30px_rgba(0,0,0,.28)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
      <div className="pointer-events-none absolute -right-10 -top-8 h-28 w-28 rounded-full bg-red-500/[.06] blur-3xl" />

      <div className="relative flex items-center gap-3">
        <div className="relative flex h-[78px] w-[74px] shrink-0 items-center justify-center">
          <svg viewBox="0 0 100 108" className="absolute inset-0 h-full w-full drop-shadow-[0_5px_9px_rgba(0,0,0,.6)]">
            <defs>
              <linearGradient id="rankFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1c2b38"/><stop offset="1" stopColor="#080e14"/></linearGradient>
              <linearGradient id="rankStroke" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f1d087"/><stop offset=".55" stopColor="#b0782e"/><stop offset="1" stopColor="#f3d998"/></linearGradient>
            </defs>
            <polygon points="50,2 95,27 95,81 50,106 5,81 5,27" fill="url(#rankFill)" stroke="url(#rankStroke)" strokeWidth="3" />
            <polygon points="50,8 89,30 89,78 50,100 11,78 11,30" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1" />
          </svg>
          <div className="relative text-center">
            <div className="text-[9px] font-black tracking-[.16em] text-amber-100/60">LEVEL</div>
            <div className="text-[28px] font-black leading-none text-white">{game.level}</div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black tracking-[.15em] text-[#7f91a3]">CURRENT TITLE</p>
          <div className="mt-1 game-cut-card flex min-h-[40px] items-center gap-2 border border-white/10 bg-black/25 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
            <Crown size={15} className="shrink-0 text-amber-300" />
            <p className="truncate text-[13px] font-black text-white">{highestTitle?.label ?? "称号未獲得"}</p>
          </div>
        </div>
      </div>

      <div className="relative mt-2 grid grid-cols-2 gap-2">
        <div className="game-cut-card flex min-h-[68px] items-center gap-2.5 border border-orange-400/20 bg-[linear-gradient(145deg,#21191a,#10151b)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.07),0_7px_14px_rgba(0,0,0,.25)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-orange-300/20 bg-[radial-gradient(circle_at_35%_25%,#ffb24a,#ee4f24_55%,#7d1416)] shadow-[0_0_16px_rgba(239,68,68,.22)]"><Flame size={21} className="text-white" fill="currentColor" /></span>
          <div className="min-w-0"><p className="text-[21px] font-black leading-none">{game.streak}<span className="ml-1 text-[11px] text-white/70">勤務連続</span></p><p className="mt-1 truncate text-[9px] font-bold text-[#8fa0b1]">連続シフト達成記録</p></div>
        </div>
        <div className="game-cut-card flex min-h-[68px] items-center gap-2.5 border border-amber-300/20 bg-[linear-gradient(145deg,#211f17,#10151a)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.07),0_7px_14px_rgba(0,0,0,.25)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-[radial-gradient(circle_at_35%_25%,#fff0a3,#e4aa29_58%,#875d12)] shadow-[0_0_16px_rgba(245,158,11,.18)]"><Coins size={20} className="text-[#4f3408]" /></span>
          <div className="min-w-0"><p className="truncate text-[21px] font-black leading-none">{game.coins.toLocaleString("ja-JP")}</p><p className="mt-1 text-[10px] font-bold text-[#8fa0b1]">コイン</p></div>
        </div>
      </div>

      <div className="relative mt-2 game-cut-card border border-white/10 bg-black/30 px-3 py-2.5 shadow-[inset_0_2px_8px_rgba(0,0,0,.45)]">
        <div className="flex items-center gap-3"><span className="text-[14px] font-black">EXP</span><div className="h-2.5 flex-1 overflow-hidden rounded-full border border-white/10 bg-[#1a222b]"><div className="h-full rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-300 shadow-[0_0_9px_rgba(239,68,68,.45)]" style={{width:`${xpPercent}%`}} /></div><span className="min-w-[62px] text-right text-[12px] font-black tabular-nums">{game.xpIntoLevel} / {game.xpForNextLevel}</span></div>
        <p className="mt-1 text-center text-[9px] font-bold text-[#708194]">レベル{game.level + 1}まであと{Math.max(0, game.xpForNextLevel - game.xpIntoLevel)}EXP</p>
      </div>
    </section>
  );
}
