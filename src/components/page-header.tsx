import type { LucideIcon } from "lucide-react";
import { MetalIcon } from "./metal-icon";
export function PageHeader({ icon, title, eyebrow, action }: { icon: LucideIcon; title: string; eyebrow?: string; action?: React.ReactNode; }) {
  return <header className="cinema-header game-cut-card">
    <div className="cinema-header-city" />
    <div className="relative z-10 flex items-center justify-between gap-3">
      <div className="min-w-0 flex items-center gap-3">
        <MetalIcon icon={icon} tone="silver" size={22}/>
        <div className="min-w-0">{eyebrow&&<p className="mb-0.5 truncate text-[10px] font-black tracking-[.12em] text-[#d5b36b]">{eyebrow}</p>}<h1 className="truncate text-[23px] font-black text-white">{title}</h1></div>
      </div>{action&&<div className="shrink-0">{action}</div>}
    </div>
  </header>;
}
