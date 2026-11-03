"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  Bot,
  Building2,
  CalendarDays,
  Clock3,
  FileText,
  Gift,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ChevronDown,
  Bell,
  Mail,
  MessageCircle,
  ReceiptText,
  Users,
} from "lucide-react";
import { clearAdminCookieAction } from "./nav-actions";

const links = [
  { href: "/admin", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/admin/staff", label: "スタッフ", icon: Users },
  { href: "/admin/shifts", label: "シフト", icon: CalendarDays },
  { href: "/admin/records", label: "打刻記録", icon: Clock3 },
  { href: "/admin/simple-attendance", label: "簡易勤怠", icon: ListChecks },
  { href: "/admin/payments", label: "振込関係", icon: Banknote },
  { href: "/admin/clients", label: "取引先窓口", icon: Building2 },
  { href: "/admin/attendance-requests", label: "申請・報告管理", icon: Inbox },
  { href: "/admin/expenses", label: "経費", icon: ReceiptText },
  { href: "/admin/compensation", label: "別途報酬", icon: Gift },
  { href: "/admin/coin-exchanges", label: "コイン交換", icon: Gift },
  { href: "/admin/invoices", label: "請求", icon: FileText },
  { href: "/admin/admins", label: "通知先", icon: Mail },
  { href: "/admin/line", label: "LINE通知", icon: MessageCircle },
  { href: "/admin/bot", label: "BOT管理", icon: Bot },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/pending-count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setPendingCount(data.count ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function logout() {
    await clearAdminCookieAction();
    router.push("/admin/gate");
    router.refresh();
  }

  return (
    <div className="kj-admin-shell">
      <div className="kj-topbar">
        <div className="kj-topbar-inner">
          <div className="kj-brand">
            <span className="kj-brand-mark">KJ</span>
            <div><div className="kj-brand-name">K.J SYSTEM</div><div className="kj-brand-sub">勤怠管理システム</div></div>
          </div>
          <div className="kj-topbar-right">
            <span className="kj-topbar-icon" aria-hidden="true"><Bell size={22} /></span>
            <span className="kj-avatar" aria-hidden="true">KJ</span>
            <span className="kj-admin-label">管理者</span><ChevronDown size={17} />
          </div>
        </div>
      </div>
      <div className="kj-menu-title-row">
        <div className="kj-menu-title"><span className="kj-title-bar" /><strong>管理者メニュー</strong><span className="kj-menu-english">Administrator Menu</span></div>
        <button type="button" onClick={logout} className="kj-logout"><LogOut size={21} />ログアウト</button>
      </div>
      <nav className="kj-menu-panel" aria-label="管理者メニュー">
        {links.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`kj-menu-button ${active ? "is-active" : ""}`}>
              <Icon size={18} strokeWidth={2.1} />
              <span>{item.label}</span>
              {item.href === "/admin/attendance-requests" && pendingCount > 0 && <span className="kj-pending-count">{pendingCount}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
