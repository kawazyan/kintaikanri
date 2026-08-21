import Link from "next/link";
import { Award, ChevronRight } from "lucide-react";
import type { GameState } from "@/lib/game";

export function GamePanel({ game }: { game: GameState }) {
  const xpPercent =
    game.xpForNextLevel > 0 ? Math.round((game.xpIntoLevel / game.xpForNextLevel) * 100) : 0;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-blue-400/80 uppercase">
          ゲーム状況
        </h2>
        <Link
          href="/titles"
          className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 shadow-sm shadow-black/30 transition active:scale-95"
        >
          <Award size={12} />
          称号一覧
          <ChevronRight size={12} className="text-slate-500" />
        </Link>
      </div>

      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1 font-semibold text-orange-300">
          🔥 {game.streak}勤務連続
        </span>
        <span className="flex items-center gap-1 font-semibold text-amber-300">
          🪙 {game.coins.toLocaleString("ja-JP")}
        </span>
      </div>

      <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
        <span>Lv.{game.level}</span>
        <span>
          {game.xpIntoLevel} / {game.xpForNextLevel} XP
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
          style={{ width: `${xpPercent}%` }}
        />
      </div>

      {game.titles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {game.titles.map((t) => (
            <span
              key={t.code}
              className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white shadow shadow-blue-950/50"
            >
              {t.label}
            </span>
          ))}
        </div>
      )}

      {game.perfectAttendanceThisMonth && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-1.5 text-center text-xs font-semibold text-amber-300">
          🏆 今月の皆勤賞を達成しました!
        </p>
      )}
    </section>
  );
}
