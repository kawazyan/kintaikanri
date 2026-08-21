import { redirect } from "next/navigation";
import Link from "next/link";
import { Sofa } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/bottom-tab-bar";

export default async function MyRoomPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-6 px-4 pt-6 pb-28">
      <Link href="/menu" className="text-sm text-blue-400 underline">
        ← メニューへ戻る
      </Link>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-800 bg-slate-900/60">
          <Sofa size={28} className="text-slate-600" />
        </div>
        <h1 className="text-lg font-bold text-slate-200">マイルーム</h1>
        <p className="text-sm text-slate-500">近日公開予定です。お楽しみに!</p>
      </div>

      <BottomTabBar />
    </main>
  );
}
