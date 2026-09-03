"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileText,
  Gift,
  LayoutDashboard,
  LogOut,
  Mail,
  ReceiptText,
  Users,
} from "lucide-react";
import { clearAdminCookieAction } from "./nav-actions";

const links = [
  { href: "/admin", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/admin/staff", label: "スタッフ", icon: Users },
  { href: "/admin/shifts", label: "シフト", icon: CalendarDays },
  { href: "/admin/records", label: "打刻記録", icon: Clock3 },
  { href: "/admin/payments", label: "振込申請", icon: Banknote },
  { href: "/admin/clients", label: "取引先窓口", icon: Building2 },
  { href: "/admin/requests", label: "稼働依頼", icon: ClipboardCheck },
  { href: "/admin/expenses", label: "経費", icon: ReceiptText },
  { href: "/admin/compensation", label: "別途報酬", icon: Gift },
  { href: "/admin/invoices", label: "請求", icon: FileText },
  { href: "/admin/admins", label: "通知先", icon: Mail },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await clearAdminCookieAction();
    router.push("/admin/gate");
    router.refresh();
  }

  return (
    <div className="admin-nav mb-7 rounded-[24px] border border-slate-200 bg-white/95 p-3 shadow-[0_12px_32px_rgba(15,23,42,.08)] backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between px-2 pt-1">
        <div>
          <p className="text-[10px] font-black tracking-[0.22em] text-slate-400">K.J SYSTEM</p>
          <p className="mt-0.5 text-sm font-black text-slate-900">管理者メニュー</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition active:translate-y-0.5"
        >
          <LogOut size={15} />
          ログアウト
        </button>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition active:translate-y-0.5 ${
                active
                  ? "bg-[#14283b] text-white shadow-[0_4px_0_#091522]"
                  : "bg-[#f4f6f8] text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={16} strokeWidth={2.2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
