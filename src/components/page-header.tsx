import type { LucideIcon } from "lucide-react";

export function PageHeader({ icon: Icon, title, eyebrow, action }: { icon: LucideIcon; title: string; eyebrow?: string; action?: React.ReactNode; }) {
  return (
    <header className="relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#18293b] via-[#101c2a] to-[#0b131e] px-4 py-4 text-white shadow-[0_10px_0_#08111b,0_18px_30px_rgba(15,23,42,.16)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
      <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-red-500/12 blur-2xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-gradient-to-b from-white/12 to-white/[.04] shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_5px_10px_rgba(0,0,0,.2)]">
            <Icon size={21} className="text-red-400" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            {eyebrow ? <p className="mb-0.5 truncate text-[9px] font-black tracking-[.16em] text-red-400 uppercase">{eyebrow}</p> : null}
            <h1 className="truncate text-[20px] font-[900] tracking-[-.035em] text-white">{title}</h1>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
