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
    <section className="stone-texture relative overflow-hidden border-b border-[#9a7a40]/30 px-3 pb-3 pt-2.5 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(255,224,166,.08),transparent_24%),radial-gradient(circle_at_86%_13%,rgba(178,130,54,.10),transparent_22%)]" />
      <div className="pointer-events-none absolute right-0 top-0 h-[44%] w-[48%] opacity-25 [background-image:linear-gradient(90deg,rgba(2,5,7,.98),rgba(2,5,7,.15)),repeating-linear-gradient(90deg,transparent_0_14px,rgba(188,152,90,.20)_15px_16px,transparent_17px_31px),repeating-linear-gradient(0deg,transparent_0_18px,rgba(255,255,255,.07)_19px_20px,transparent_21px_31px)]" />

      <div className="relative rounded-[20px] border border-[#89837b] bg-black/25 p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06),inset_0_0_40px_rgba(0,0,0,.78),0_12px_30px_rgba(0,0,0,.52)]">
        <div className="pointer-events-none absolute inset-[5px] rounded-[16px] border border-[#2c3135]" />

        <div className="relative flex gap-2.5">
          <div className="relative flex h-[82px] w-[74px] shrink-0 items-center justify-center">
            <svg viewBox="0 0 100 112" className="absolute inset-0 h-full w-full drop-shadow-[0_6px_10px_rgba(0,0,0,.9)]">
              <defs>
                <linearGradient id="levelFrame" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fff3c7"/>
                  <stop offset=".18" stopColor="#8e6327"/>
                  <stop offset=".42" stopColor="#f1d38a"/>
                  <stop offset=".72" stopColor="#4b3417"/>
                  <stop offset="1" stopColor="#b48a42"/>
                </linearGradient>
                <linearGradient id="levelInner" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#252a2d"/>
                  <stop offset=".55" stopColor="#080a0c"/>
                  <stop offset="1" stopColor="#18130d"/>
                </linearGradient>
              </defs>
              <polygon points="50,1 97,28 97,84 50,111 3,84 3,28" fill="#090a0b" stroke="url(#levelFrame)" strokeWidth="4"/>
              <polygon points="50,7 91,31 91,80 50,104 9,80 9,31" fill="url(#levelInner)" stroke="#dfc17f" strokeWidth="1.5"/>
              <polygon points="50,13 85,34 85,77 50,98 15,77 15,34" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1"/>
            </svg>
            <div className="relative text-center">
              <div className="font-serif text-[8px] font-black tracking-[.1em] text-[#eee0bb] [text-shadow:0_1px_1px_#000]">LEVEL</div>
              <div className="font-serif text-[32px] font-black leading-[.9] text-[#f4f0e9] [text-shadow:0_2px_0_#51401f,0_0_5px_rgba(255,255,255,.22)]">{game.level}</div>
            </div>
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <p className="mb-1.5 text-[9px] font-bold tracking-[.18em] text-[#c5c5c2]">CURRENT TITLE</p>
            <div className="game-cut-card flex min-h-[54px] items-center gap-2.5 border border-[#b58b43]/65 bg-[linear-gradient(100deg,rgba(15,17,18,.96),rgba(6,9,11,.82))] px-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.10),inset_0_0_18px_rgba(0,0,0,.7),0_0_10px_rgba(207,164,77,.08)]">
              <Crown size={20} strokeWidth={2.2} className="shrink-0 text-[#e8b73e] drop-shadow-[0_0_5px_rgba(232,183,62,.55)]" />
              <p className="truncate text-[16px] font-black tracking-[-.03em] text-[#f3f1ec] [text-shadow:0_2px_0_#0a0a0a,0_0_6px_rgba(255,255,255,.12)]">{highestTitle?.label ?? "称号未獲得"}</p>
            </div>
          </div>
        </div>

        <div className="relative mt-2.5 grid grid-cols-2 gap-2">
          <div className="game-cut-card flex min-h-[74px] items-center gap-2.5 border border-[#8e2b27] bg-[linear-gradient(135deg,#261111_0%,#120b0c_52%,#07090b_100%)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08),inset_0_0_18px_rgba(110,15,13,.24),0_0_13px_rgba(180,25,20,.07)]">
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-[#e5b7a8] bg-[radial-gradient(circle_at_35%_26%,#e86437,#8c1715_58%,#2b0707)] shadow-[inset_0_0_0_3px_rgba(44,7,7,.55),0_0_12px_rgba(220,38,38,.34)]">
              <Flame size={22} className="text-[#f3ede7]" fill="currentColor" />
            </span>
            <div className="min-w-0">
              <p className="whitespace-nowrap font-serif text-[24px] font-black leading-none text-[#f5f2ed] [text-shadow:0_2px_0_#000]">{game.streak}</p>
              <p className="mt-1 whitespace-nowrap text-[10px] font-black text-[#e6c2b8]">勤務連続</p>
              <p className="mt-0.5 whitespace-nowrap text-[8px] font-bold text-[#aaa5a1]">連続シフト達成記録</p>
            </div>
          </div>

          <div className="game-cut-card flex min-h-[74px] items-center gap-2.5 border border-[#8a6a28] bg-[linear-gradient(135deg,#251f10_0%,#121009_52%,#07090a_100%)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08),inset_0_0_18px_rgba(135,99,21,.18),0_0_13px_rgba(202,138,4,.07)]">
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-[#fff1b0] bg-[radial-gradient(circle_at_35%_26%,#ffe58a,#d79b26_55%,#68420c)] shadow-[inset_0_0_0_3px_rgba(107,69,10,.24),0_0_12px_rgba(245,158,11,.30)]">
              <Coins size={21} strokeWidth={2.3} className="text-[#412906]" />
            </span>
            <div className="min-w-0">
              <p className="whitespace-nowrap font-serif text-[24px] font-black leading-none text-[#f5f2ed] [text-shadow:0_2px_0_#000]">{game.coins.toLocaleString("ja-JP")}</p>
              <p className="mt-1 whitespace-nowrap text-[10px] font-black text-[#e6c873]">コイン</p>
            </div>
          </div>
        </div>

        <div className="game-cut-card relative mt-2.5 border border-[#6f7170] bg-[linear-gradient(180deg,#111315,#07090a)] px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,.03),inset_0_4px_13px_rgba(0,0,0,.8)]">
          <div className="flex items-center gap-2.5">
            <span className="font-serif text-[17px] font-black text-[#e9e4dc] [text-shadow:0_2px_0_#000]">EXP</span>
            <div className="h-[10px] flex-1 overflow-hidden rounded-full border border-[#a89d89] bg-[#020304] p-[2px] shadow-[inset_0_2px_6px_rgba(0,0,0,.95)]">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#7d1915,#db3127)] shadow-[0_0_8px_rgba(219,49,39,.50)]" style={{ width: `${xpPercent}%` }} />
            </div>
            <span className="min-w-[58px] text-right font-serif text-[13px] font-black tabular-nums text-[#f0ece6]">{game.xpIntoLevel}/{game.xpForNextLevel}</span>
          </div>
          <p className="mt-1.5 text-center text-[9px] font-bold text-[#8f8d8b]">レベル{game.level + 1}まであと{Math.max(0, game.xpForNextLevel - game.xpIntoLevel)}EXP</p>
        </div>
      </div>
    </section>
  );
}
