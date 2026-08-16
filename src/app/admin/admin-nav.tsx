import Link from "next/link";
import { clearAdminCookie } from "@/lib/auth";
import { redirect } from "next/navigation";

async function logout() {
  "use server";
  await clearAdminCookie();
  redirect("/admin/gate");
}

const links = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/staff", label: "スタッフ" },
  { href: "/admin/shifts", label: "シフト" },
  { href: "/admin/records", label: "打刻記録" },
  { href: "/admin/payments", label: "振込申請" },
  { href: "/admin/admins", label: "管理者アドレス" },
];

export function AdminNav() {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-4 border-b border-slate-800 pb-3 text-sm">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="text-blue-400 hover:text-cyan-300">
          {l.label}
        </Link>
      ))}
      <form action={logout} className="ml-auto">
        <button type="submit" className="text-slate-500 underline">
          ログアウト
        </button>
      </form>
    </nav>
  );
}
