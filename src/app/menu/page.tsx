import { redirect } from "next/navigation";
import Link from "next/link";
import { Award, ChevronRight, Menu, Sofa, Users, Wallet, Sparkles, ShieldCheck, ReceiptText } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { HexIcon } from "@/components/hex-icon";
import { PageHeader } from "@/components/page-header";
import { LogoutButton } from "./logout-button";

const GAME_MENU_ITEMS = [
  { href: "/titles", label: "獲得した称号", icon: Award, tone: "red" as const },
  { href: "/my-room", label: "マイルーム", icon: Sofa, tone: "blue" as const },
  { href: "/town", label: "今日の出勤メンバー", icon: Users, tone: "green" as const },
] as const;

export default async function MenuPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  return (
    <main className="staff-screen">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28">
        <PageHeader icon={Menu} title="メニュー" eyebrow={`${staff.name} さん`} />

        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <Sparkles size={13} className="text-red-500" />
            <p className="text-[11px] font-black tracking-[.08em] text-slate-400">MY K.J</p>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {GAME_MENU_ITEMS.map(({ href, label, icon: Icon, tone }) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-[112px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[20px] border border-white/10 bg-[linear-gradient(160deg,#14171b,#07090a)] px-1.5 py-4 text-center text-white transition active:scale-[.965]"
              >
                <HexIcon icon={Icon} tone={tone} size={25} />
                <span className="mt-1 w-full whitespace-nowrap text-[clamp(9px,2.7vw,12px)] font-black tracking-[-.03em]">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 px-1 text-[11px] font-black tracking-[.08em] text-slate-400">支払い・アカウント</p>
          <div className="game-hud-frame game-cut-card overflow-hidden rounded-[20px] shadow-[0_8px_24px_rgba(15,23,42,.07)] ring-1 ring-black/[.04]">
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
