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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-4px_18px_rgba(0,0,0,.08)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[430px] items-stretch justify-between px-1 pb-[calc(.35rem+env(safe-area-inset-bottom))] pt-1.5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-bold transition active:scale-95 ${active ? "text-red-600" : "text-slate-500"}`}
            >
              {href === "/notices" && <span className="absolute right-[25%] top-0.5 h-2 w-2 rounded-full bg-red-600" />}
              <Icon size={23} strokeWidth={active ? 2.7 : 2.1} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
