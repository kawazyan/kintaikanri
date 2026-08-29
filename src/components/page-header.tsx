import type { LucideIcon } from "lucide-react";

export function PageHeader({ icon: Icon, title, eyebrow, action }: { icon: LucideIcon; title: string; eyebrow?: string; action?: React.ReactNode; }) {
  return (
    <header className="game-hud-frame game-cut-card relative overflow-hidden rounded-[20px] px-4 py-3.5 text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-red-500/10 blur-2xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-white/15 bg-white/[.06] shadow-[inset_0_1px_0_rgba(255,255,255,.13)]">
            <Icon size={20} className="text-red-400" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            {eyebrow ? <p className="mb-0.5 truncate text-[9px] font-black tracking-[.14em] text-red-400">{eyebrow}</p> : null}
            <h1 className="truncate text-[21px] font-black text-white">{title}</h1>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
