import { redirect } from "next/navigation";
import Link from "next/link";
import { Award, Sofa, Users, Wallet, ArrowLeftRight, ChevronRight, type LucideIcon } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { switchUser } from "../identify-actions";
import { BottomTabBar } from "@/components/bottom-tab-bar";

const MENU_ITEMS: { href: string; label: string; description: string; icon: LucideIcon }[] = [
  { href: "/titles", label: "称号コレクション", description: "獲得したバッジ・称号を確認", icon: Award },
  { href: "/my-room", label: "マイルーム", description: "コインでお部屋をカスタマイズ", icon: Sofa },
  { href: "/town", label: "仲間のタウン", description: "今日出勤しているスタッフを見る", icon: Users },
  { href: "/payment/history", label: "振込申請履歴", description: "これまでの振込申請を確認", icon: Wallet },
];

export default async function MenuPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-4 pt-6 pb-28">
      <div>
        <p className="text-sm text-slate-400">{staff.name} さん</p>
        <h1 className="mt-1 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
          メニュー
        </h1>
      </div>

      <div className="flex flex-col gap-2.5">
        {MENU_ITEMS.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur-sm transition active:scale-[0.98] active:bg-slate-800/60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-md shadow-blue-950/50">
              <Icon size={20} className="text-white" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-slate-100">{label}</span>
              <span className="block text-xs text-slate-500">{description}</span>
            </span>
            <ChevronRight size={18} className="text-slate-600" />
          </Link>
        ))}
      </div>

      <form action={switchUser}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-left shadow-md shadow-black/30 backdrop-blur-sm transition active:scale-[0.98] active:bg-slate-800/60"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800">
            <ArrowLeftRight size={20} className="text-slate-300" />
          </span>
          <span className="flex-1 text-sm font-semibold text-slate-300">利用者を切り替える</span>
        </button>
      </form>

      <BottomTabBar />
    </main>
  );
}
