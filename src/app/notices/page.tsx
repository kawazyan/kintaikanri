import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/bottom-tab-bar";

export default async function NoticesPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-4 pt-6 pb-28">
      <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        お知らせ
      </h1>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-800 bg-slate-900/60">
          <Bell size={28} className="text-slate-600" />
        </div>
        <p className="text-sm text-slate-500">現在お知らせはありません。</p>
      </div>

      <BottomTabBar />
    </main>
  );
}
