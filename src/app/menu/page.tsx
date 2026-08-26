import { redirect } from "next/navigation";
import Link from "next/link";
import { Wallet, LogOut, ChevronRight, Menu } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { switchUser } from "../identify-actions";
import { BottomTabBar } from "@/components/bottom-tab-bar";

const GAME_MENU_ITEMS: {
  href: string;
  label: string;
  description: string;
  emoji: string;
  gradient: string;
  glow: string;
}[] = [
  {
    href: "/titles",
    label: "称号コレクション",
    description: "獲得した称号を確認",
    emoji: "🏆",
    gradient: "from-red-400 via-red-600 to-red-800",
    glow: "rgba(220,38,38,0.45)",
  },
  {
    href: "/my-room",
    label: "マイルーム",
    description: "コインでアイテム購入",
    emoji: "🛋️",
    gradient: "from-amber-300 via-orange-500 to-orange-700",
    glow: "rgba(249,115,22,0.45)",
  },
  {
    href: "/town",
    label: "仲間のタウン",
    description: "今日出勤している仲間",
    emoji: "👥",
    gradient: "from-yellow-300 via-amber-500 to-yellow-700",
    glow: "rgba(234,179,8,0.45)",
  },
];

export default async function MenuPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  return (
    <main className="min-h-dvh bg-gradient-to-b from-white via-[#fdfaf5] to-[#faf5eb]">
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 pt-6 pb-28">
      <div>
        <p className="text-sm text-slate-600">{staff.name} さん</p>
        <h1 className="mt-1 flex items-center gap-2 bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-xl font-bold text-transparent">
          <Menu size={20} className="text-red-500" />
          メニュー
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {GAME_MENU_ITEMS.map(({ href, label, description, emoji, gradient, glow }) => (
          <Link
            key={href}
            href={href}
            style={{
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 16px ${glow}, 0 3px 6px rgba(0,0,0,0.4)`,
            }}
            className={`relative flex flex-col items-center gap-1 overflow-hidden rounded-2xl bg-gradient-to-b ${gradient} px-2 py-4 text-center transition active:scale-[0.96]`}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
            <span className="relative text-3xl drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]">
              {emoji}
            </span>
            <span className="relative text-xs font-bold text-white">{label}</span>
            <span className="relative text-[9px] leading-tight text-white/80">{description}</span>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <Link
          href="/payment/history"
          className="flex items-center gap-3 rounded-2xl bg-gradient-to-b from-white to-slate-100 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition active:scale-[0.98]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 shadow-[0_2px_8px_rgba(220,38,38,0.5)]">
            <Wallet size={20} className="text-white" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-slate-900">振込申請履歴</span>
            <span className="block text-xs text-slate-500">これまでの振込申請を確認</span>
          </span>
          <ChevronRight size={18} className="text-slate-400" />
        </Link>
      </div>

      <form action={switchUser}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition active:scale-[0.98]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <LogOut size={20} className="text-red-600" />
          </span>
          <span className="flex-1 text-sm font-semibold text-red-600">ログアウト</span>
        </button>
      </form>
    </div>

      <BottomTabBar />
    </main>
  );
}
