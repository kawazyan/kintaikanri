"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, CalendarDays, Bell, Menu, type LucideIcon } from "lucide-react";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/clock", label: "ホーム", icon: Home },
  { href: "/history", label: "打刻履歴", icon: History },
  { href: "/shift", label: "シフト", icon: CalendarDays },
  { href: "/notices", label: "お知らせ", icon: Bell },
  { href: "/menu", label: "メニュー", icon: Menu },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/90 shadow-[0_-4px_20px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <div className="mx-auto flex max-w-sm items-stretch justify-between px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition active:scale-95 ${
                active ? "text-cyan-300" : "text-slate-500"
              }`}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 2}
                className={active ? "drop-shadow-[0_0_6px_rgba(34,211,238,0.55)]" : ""}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
