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
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/95 shadow-[0_-8px_28px_rgba(15,23,42,.10)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[430px] items-stretch justify-between px-1.5 pb-[calc(.4rem+env(safe-area-inset-bottom))] pt-1.5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/clock" && pathname.startsWith(`${href}/`));
          const className = `relative flex min-h-[49px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[15px] px-1 py-1 text-[10px] font-black transition active:scale-95 ${active ? "text-red-600" : "text-slate-400"}`;

          if (href === "/clock") {
            return (
              <button
                key={href}
                type="button"
                aria-label="ホームへ戻る"
                aria-current={active ? "page" : undefined}
                className={className}
                onClick={() => {
                  // SPAの履歴状態に依存せず、どの画面からでも確実にホームへ戻す。
                  window.location.assign("/clock");
                }}
              >
                {active ? <span className="absolute top-0 h-1 w-5 rounded-full bg-red-600" /> : null}
                <Icon size={22} strokeWidth={active ? 2.7 : 2.1} />
                <span>{label}</span>
              </button>
            );
          }

          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={className}>
              {active ? <span className="absolute top-0 h-1 w-5 rounded-full bg-red-600" /> : null}
              <Icon size={22} strokeWidth={active ? 2.7 : 2.1} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
