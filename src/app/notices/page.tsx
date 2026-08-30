import { redirect } from "next/navigation";
import { Bell, BellRing, CheckCircle2 } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { PageHeader } from "@/components/page-header";

export default async function NoticesPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  return (
    <main className="staff-screen">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28">
        <PageHeader icon={Bell} title="お知らせ" centered />

        <section className="game-hud-frame game-cut-card relative overflow-hidden rounded-[20px] px-6 py-12 text-center shadow-[0_9px_26px_rgba(15,23,42,.07)] ring-1 ring-black/[.04]">
          <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-red-100/70 blur-2xl" />
          <span className="relative mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-[22px] bg-gradient-to-br from-red-50 to-slate-50 ring-1 ring-red-100">
            <BellRing size={29} className="text-red-500" />
          </span>
          <h2 className="relative mt-4 text-[15px] font-black text-slate-900">お知らせはありません</h2>
          <p className="relative mx-auto mt-1.5 max-w-[250px] text-xs font-semibold leading-relaxed text-slate-400">
            新しい連絡やシフトに関するお知らせが届くと、この画面に表示されます。
          </p>
          <div className="relative mx-auto mt-5 flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-100">
            <CheckCircle2 size={12} /> 現在、確認が必要なお知らせはありません
          </div>
        </section>
      </div>
      <BottomTabBar />
    </main>
  );
}
