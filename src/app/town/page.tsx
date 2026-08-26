import { redirect } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/bottom-tab-bar";

export default async function TownPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 bg-gradient-to-b from-white via-[#fdfaf5] to-[#faf5eb] px-4 pt-6 pb-28">
      <Link href="/menu" className="text-sm text-red-500 underline">
        ← メニューへ戻る
      </Link>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 shadow-[0_4px_14px_rgba(0,0,0,0.1)]">
          <Users size={28} className="text-amber-500" />
        </div>
        <h1 className="text-lg font-bold text-slate-800">仲間のタウン</h1>
        <p className="text-sm text-slate-500">近日公開予定です。お楽しみに!</p>
      </div>

      <BottomTabBar />
    </main>
  );
}
