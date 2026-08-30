import { CalendarDays, Gift, Check, Star } from "lucide-react";
import { yearMonthLabel } from "@/lib/time";
import type { GameState } from "@/lib/game";

export function StampCard({ stamp }: { stamp: GameState["stamp"] }) {
  const remaining = Math.max(0, stamp.targetDays - stamp.completedDays);
  const percent = stamp.targetDays > 0
    ? Math.min(100, Math.round((stamp.completedDays / stamp.targetDays) * 100))
    : 0;

  return (
    <section className="relative overflow-hidden rounded-[24px] border border-[#706d69] bg-[#050708] px-3.5 py-4 text-[#eee9df] shadow-[inset_0_0_0_1px_rgba(255,255,255,.04),inset_0_0_32px_rgba(0,0,0,.88),0_12px_28px_rgba(0,0,0,.38)]">
      <div className="pointer-events-none absolute inset-[5px] rounded-[19px] border border-[#292c2e]" />
      <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:repeating-linear-gradient(118deg,transparent_0,transparent_8px,rgba(255,255,255,.015)_9px,transparent_10px)]" />
      <div className="pointer-events-none absolute left-0 top-0 h-32 w-48 bg-[radial-gradient(circle_at_0_0,rgba(175,35,24,.23),transparent_68%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-20 w-40 bg-[radial-gradient(circle_at_100%_100%,rgba(162,107,30,.10),transparent_70%)]" />

      <div className="relative flex items-start justify-between gap-2.5 px-1">
        <h2 className="flex min-w-0 items-center gap-2.5 text-[18px] font-black tracking-[-.045em] text-[#f0ece4] [text-shadow:0_2px_0_#000,0_0_7px_rgba(255,255,255,.13)]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-[#8e8780] bg-[linear-gradient(145deg,#292c2f,#080a0b)] shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_2px_4px_rgba(0,0,0,.75)]">
            <CalendarDays size={21} strokeWidth={2.4} className="text-[#eee9df]" />
          </span>
          <span className="whitespace-nowrap text-[clamp(13px,3.8vw,17px)] leading-none">{yearMonthLabel(stamp.yearMonth)}の勤務スタンプ</span>
        </h2>
        <div className="shrink-0 text-right text-[9px] font-bold leading-[1.55] text-[#aaa39a]">
          <div>今月の目標：{stamp.targetDays}勤務</div>
          <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-black text-[#e23a30]"><Gift size={12} />達成で {stamp.bonusCoins}コイン</div>
        </div>
      </div>

      <div className="relative my-4 grid grid-cols-10 gap-x-[6px] gap-y-3 px-1">
        {stamp.cells.map((cell) => {
          const isMilestone = (cell.index + 1) % 5 === 0;
          if (cell.state === "stamped") {
            return (
              <div
                key={cell.index}
                aria-label={`${cell.index + 1}勤務目・達成`}
                className="relative aspect-square rounded-full border border-[#756f68] bg-[#050607] shadow-[inset_0_0_0_2px_#17191a,inset_0_0_9px_#000,0_1px_1px_rgba(255,255,255,.09)]"
              >
                <div className="absolute inset-[3px] rounded-full border border-[#2d2b28] bg-[radial-gradient(circle_at_42%_34%,#151311,#060707_70%)]" />
                {isMilestone ? (
                  <>
                    <div className="absolute inset-[-2px] rounded-full border border-[#ffd27a] shadow-[0_0_7px_#e5ab3a,0_0_14px_rgba(229,171,58,.68),inset_0_0_7px_rgba(229,171,58,.50)]" />
                    <div className="absolute inset-[5px] rounded-full border border-[#a3781e] bg-[radial-gradient(circle,#caa53a_0%,#6b4b0e_46%,#140f06_78%)] shadow-[inset_0_0_7px_#f0c563,0_0_6px_rgba(240,197,99,.58)]" />
                    <Star size={11} strokeWidth={2.5} fill="currentColor" className="absolute inset-0 m-auto text-white drop-shadow-[0_1px_1px_rgba(0,0,0,.5)]" />
                  </>
                ) : (
                  <>
                    <div className="absolute inset-[-2px] rounded-full border border-[#ff4b40] shadow-[0_0_7px_#ef2d24,0_0_14px_rgba(239,45,36,.68),inset_0_0_7px_rgba(239,45,36,.50)]" />
                    <div className="absolute inset-[5px] rounded-full border border-[#aa211a] bg-[radial-gradient(circle,#a8241d_0%,#5c120e_46%,#140706_78%)] shadow-[inset_0_0_7px_#e33a30,0_0_6px_rgba(227,58,48,.58)]" />
                    <Check size={11} strokeWidth={3.2} className="absolute inset-0 m-auto text-white drop-shadow-[0_1px_1px_rgba(0,0,0,.5)]" />
                  </>
                )}
              </div>
            );
          }
          return (
            <div
              key={cell.index}
              aria-label={`${cell.index + 1}勤務目`}
              className="relative aspect-square rounded-full border border-[#756f68] bg-[#050607] shadow-[inset_0_0_0_2px_#17191a,inset_0_0_9px_#000,0_1px_1px_rgba(255,255,255,.09)]"
            >
              <div className="absolute inset-[3px] rounded-full border border-[#2d2b28] bg-[radial-gradient(circle_at_42%_34%,#151311,#060707_70%)]" />
              {cell.state === "today" && (
                <>
                  <div className="absolute inset-[-1px] rounded-full border border-dashed border-[#ff4b40]/70" />
                  <span className="absolute inset-0 m-auto h-[5px] w-[5px] rounded-full bg-[#d73127] shadow-[0_0_5px_#ff4b40]" />
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="relative flex items-end justify-between gap-2 px-1 pt-1">
        <p className="whitespace-nowrap text-[29px] font-black leading-none text-[#b92720] [text-shadow:0_2px_0_#000,0_0_7px_rgba(190,37,29,.22)]">
          {stamp.completedDays}<span className="ml-1.5 font-sans text-[14px] text-[#e9e4db]">/ {stamp.targetDays} 勤務達成</span>
        </p>
        <p className="text-right text-[13px] font-black text-[#e8e2d9] [text-shadow:0_1px_0_#000]">
          {stamp.bonusAwarded ? "目標達成！" : <>あと <span className="text-[22px] text-[#c92a22]">{remaining}</span> 勤務でボーナス！</>}
        </p>
      </div>

      <div className="relative mt-3 flex items-center gap-3 px-1">
        <div className="h-[15px] flex-1 overflow-hidden rounded-full border border-[#756a5c] bg-[#030405] p-[2px] shadow-[inset_0_2px_7px_#000,inset_0_0_0_1px_rgba(255,255,255,.02)]">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#7e1511,#d72d24)] shadow-[0_0_8px_rgba(215,45,36,.58)]" style={{ width: `${percent}%` }} />
        </div>
        <span className="min-w-[34px] text-right text-[15px] font-black text-[#ddd7ce]">{percent}%</span>
      </div>

      {stamp.bonusAwarded && (
        <div className="relative mt-3 flex items-center justify-center gap-2 rounded-xl border border-[#a3781e]/50 bg-[linear-gradient(145deg,#241f10,#0d0a05)] px-3 py-2 text-xs font-bold text-[#e5c26a]">
          <Gift size={16} /> ボーナスコイン獲得済み
        </div>
      )}
    </section>
  );
}
