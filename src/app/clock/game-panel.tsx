import { Crown, Flame, Coins } from "lucide-react";
import type { GameState } from "@/lib/game";
import { TITLE_DEFINITIONS } from "@/lib/game-config";

export function GamePanel({ game }: { game: GameState }) {
  const xpPercent = game.xpForNextLevel > 0
    ? Math.min(100, Math.round((game.xpIntoLevel / game.xpForNextLevel) * 100))
    : 0;
  const achievedCodes = new Set(game.titles.map((t) => t.code));
  const highestDefinition = [...TITLE_DEFINITIONS].reverse().find((d) => achievedCodes.has(d.code));
  const highestTitle = highestDefinition ? game.titles.find((t) => t.code === highestDefinition.code) : null;

  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(160deg,#14171b_0%,#050608_60%,#0a0808_100%)] px-3.5 pb-3 pt-3 text-white">
      <div className="relative flex items-center gap-3">
        <div className="hex-icon hex-icon--gold hex-icon-sm shrink-0 flex-col gap-0">
          <span className="text-[9px] font-black leading-none tracking-wide text-[#eee0bb]">Lv.</span>
          <span className="mt-0.5 text-[22px] font-black leading-none text-white">{game.level}</span>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[.04] py-2 pl-3 pr-3.5">
          <Crown size={16} strokeWidth={2.2} className="shrink-0 text-[#e8c368]" />
          <p className="truncate text-[14px] font-bold text-[#f3f1ec]">{highestTitle?.label ?? "称号未獲得"}</p>
        </div>
      </div>

      <div className="relative mt-2.5 grid grid-cols-2 gap-2">
        <div className="game-cut-card flex min-h-[64px] items-center gap-2.5 border border-[#8e2b27] bg-[linear-gradient(135deg,#261111_0%,#120b0c_52%,#07090b_100%)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08),inset_0_0_18px_rgba(110,15,13,.24)]">
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-[#e5b7a8] bg-[radial-gradient(circle_at_35%_26%,#e86437,#8c1715_58%,#2b0707)] shadow-[inset_0_0_0_3px_rgba(44,7,7,.55),0_0_10px_rgba(220,38,38,.34)]">
            <Flame size={19} className="text-[#f3ede7]" fill="currentColor" />
          </span>
          <div className="min-w-0">
            <p className="whitespace-nowrap text-[18px] font-black leading-none text-[#f5f2ed]">
              {game.streak}<span className="ml-1.5 text-[11px] font-bold text-[#e6c2b8]">早出連続</span>
            </p>
            <p className="mt-1 whitespace-nowrap text-[8px] font-bold text-[#aaa5a1]">連続早出出勤の記録</p>
          </div>
        </div>

        <div className="game-cut-card flex min-h-[64px] items-center gap-2.5 border border-[#8a6a28] bg-[linear-gradient(135deg,#251f10_0%,#121009_52%,#07090a_100%)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08),inset_0_0_18px_rgba(135,99,21,.18)]">
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-[#fff1b0] bg-[radial-gradient(circle_at_35%_26%,#ffe58a,#d79b26_55%,#68420c)] shadow-[inset_0_0_0_3px_rgba(107,69,10,.24),0_0_10px_rgba(245,158,11,.30)]">
            <Coins size={18} strokeWidth={2.3} className="text-[#412906]" />
          </span>
          <div className="min-w-0">
            <p className="whitespace-nowrap text-[18px] font-black leading-none text-[#f5f2ed]">
              {game.coins.toLocaleString("ja-JP")}<span className="ml-1.5 text-[11px] font-bold text-[#e6c873]">コイン</span>
            </p>
            <p className="mt-1 whitespace-nowrap text-[8px] font-bold text-[#aaa5a1]">貯まったコイン</p>
          </div>
        </div>
      </div>

      <div className="game-cut-card relative mt-2.5 border border-white/10 bg-[linear-gradient(180deg,#111315,#07090a)] px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-black text-[#e9e4dc]">EXP</span>
          <div className="h-[9px] flex-1 overflow-hidden rounded-full border border-white/15 bg-[#020304] p-[2px]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#7d1915,#db3127)] shadow-[0_0_8px_rgba(219,49,39,.50)]" style={{ width: `${xpPercent}%` }} />
          </div>
          <span className="min-w-[54px] text-right text-[12px] font-black tabular-nums text-[#f0ece6]">{game.xpIntoLevel}/{game.xpForNextLevel}</span>
        </div>
        <p className="mt-1.5 text-center text-[9px] font-bold text-[#8f8d8b]">レベル{game.level + 1}まであと{Math.max(0, game.xpForNextLevel - game.xpIntoLevel)}EXP</p>
      </div>
    </section>
  );
}
