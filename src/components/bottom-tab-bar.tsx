"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Clock3, Bell, Menu, type LucideIcon } from "lucide-react";

type Tab = { href: string; label: string; icon: LucideIcon; center?: boolean };

const TABS: Tab[] = [
  { href: "/clock", label: "ホーム", icon: Home },
  { href: "/shift", label: "シフト", icon: CalendarDays },
  { href: "/clock#punch", label: "打刻", icon: Clock3, center: true },
  { href: "/notices", label: "お知らせ", icon: Bell },
  { href: "/menu", label: "メニュー", icon: Menu },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="app-bottom-nav" aria-label="メインナビゲーション">
      <div className="app-bottom-nav__inner">
        {TABS.map(({ href, label, icon: Icon, center }) => {
          const baseHref = href.split("#")[0];
          const active = !center && (pathname === baseHref || (baseHref !== "/clock" && pathname.startsWith(`${baseHref}/`)));
          const content = (
            <>
              <span className={center ? "app-bottom-nav__centerIcon" : "app-bottom-nav__icon"}>
                <Icon size={center ? 25 : 21} strokeWidth={active || center ? 2.7 : 2.15} />
              </span>
              <span className="app-bottom-nav__label">{label}</span>
            </>
          );

          return (
            <Link
              key={href}
              href={href}
              className={`app-bottom-nav__item ${center ? "is-center" : ""} ${active ? "is-active" : ""}`}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
