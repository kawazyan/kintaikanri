import { redirect } from "next/navigation";
import Link from "next/link";
import { Award, ChevronRight, Menu, Sofa, Users, Wallet, Sparkles, ShieldCheck, ReceiptText } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { PageHeader } from "@/components/page-header";
import { LogoutButton } from "./logout-button";

const GAME_MENU_ITEMS = [
  {
    href: "/titles",
    label: "獲得した称号",
    icon: Award,
    card: "from-[#491416] via-[#271a22] to-[#111827]",
    glow: "bg-red-500/10",
  },
  {
    href: "/my-room",
    label: "マイルーム",
    icon: Sofa,
    card: "from-[#253547] via-[#18283a] to-[#101a26]",
    glow: "bg-slate-300/10",
  },
  {
    href: "/town",
    label: "今日の出勤メンバー",
    icon: Users,
    card: "from-[#203b3a] via-[#183231] to-[#102526]",
    glow: "bg-emerald-300/10",
  },
] as const;

export default async function MenuPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#fbfbfc] via-[#f7f8fa] to-[#f1f3f6] text-slate-900">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28">
        <PageHeader icon={Menu} title="メニュー" eyebrow={`${staff.name} さん`} />

        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <Sparkles size={13} className="text-red-500" />
            <p className="text-[11px] font-black tracking-[.08em] text-slate-400">MY K.J</p>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {GAME_MENU_ITEMS.map(({ href, label, icon: Icon, card, glow }) => (
              <Link
                key={href}
                href={href}
                className={`group relative flex min-h-[112px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-[24px] bg-gradient-to-br ${card} px-1.5 py-4 text-center text-white shadow-[0_10px_24px_rgba(15,23,42,.16)] ring-1 ring-white/25 transition active:scale-[.965]`}
              >
                <span className={`pointer-events-none absolute -right-5 -top-6 h-20 w-20 rounded-full ${glow} blur-xl`} />
                <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/24 to-transparent" />
                <span className="relative flex h-11 w-11 items-center justify-center rounded-[15px] bg-white/16 ring-1 ring-white/20 backdrop-blur-sm">
                  <Icon size={24} strokeWidth={2.4} />
                </span>
                <span className="relative mt-2 w-full whitespace-nowrap text-[clamp(9px,2.7vw,12px)] font-black tracking-[-.03em]">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 px-1 text-[11px] font-black tracking-[.08em] text-slate-400">支払い・アカウント</p>
          <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_8px_24px_rgba(15,23,42,.07)] ring-1 ring-black/[.04]">
            <Link href="/payment/history" className="flex items-center gap-3 p-4 transition active:bg-slate-50">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-red-50 to-slate-50 ring-1 ring-red-100">
                <Wallet size={21} className="text-red-600" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-900">振込申請履歴</span>
                <span className="mt-0.5 block text-[11px] font-semibold text-slate-400">申請済みの振込状況を確認</span>
              </span>
              <ChevronRight size={19} className="shrink-0 text-slate-300" />
            </Link>

            <div className="mx-4 h-px bg-slate-100" />

            <Link href="/expenses" className="flex items-center gap-3 p-4 transition active:bg-slate-50">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-slate-50 ring-1 ring-slate-100">
                <ReceiptText size={21} className="text-slate-700" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-900">経費申請</span>
                <span className="mt-0.5 block text-[11px] font-semibold text-slate-400">交通費・宿泊費・その他経費</span>
              </span>
              <ChevronRight size={19} className="shrink-0 text-slate-300" />
            </Link>

            <div className="mx-4 h-px bg-slate-100" />

            <div className="flex items-center gap-3 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-slate-50 ring-1 ring-slate-100">
                <ShieldCheck size={21} className="text-slate-500" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-900">ログイン中</span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-400">{staff.name} さん</span>
              </span>
            </div>
          </div>
        </section>

        <LogoutButton />
      </div>
      <BottomTabBar />
    </main>
  );
}
