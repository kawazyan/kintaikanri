import type { LucideIcon } from "lucide-react";

export function PageHeader({
  icon: Icon,
  title,
  eyebrow,
  action,
}: {
  icon: LucideIcon;
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-[24px] bg-white px-4 py-4 shadow-[0_8px_26px_rgba(15,23,42,.07)] ring-1 ring-black/[.04]">
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-red-100/70 blur-2xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-[10px] font-black tracking-[.14em] text-red-500/80 uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="flex min-w-0 items-center gap-2.5 text-[20px] font-black tracking-tight text-slate-950">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-red-100">
              <Icon size={20} className="text-red-600" strokeWidth={2.45} />
            </span>
            <span className="truncate">{title}</span>
          </h1>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
