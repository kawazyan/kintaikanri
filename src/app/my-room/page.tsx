import { redirect } from "next/navigation";
import Link from "next/link";
import { Sofa } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { CharacterPicker } from "./character-picker";

export default async function MyRoomPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  return (
    <main className="min-h-dvh bg-gradient-to-b from-white via-[#fdfaf5] to-[#faf5eb]">
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 pt-6 pb-28">
      <Link href="/menu" className="text-sm text-red-500 underline">
        ← メニューへ戻る
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50 shadow-[0_4px_14px_rgba(0,0,0,0.1)]">
          <Sofa size={22} className="text-orange-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">マイルーム</h1>
          <p className="text-sm text-slate-500">ホーム画面のキャラクターを選べます</p>
        </div>
      </div>

      <section className="rounded-2xl bg-gradient-to-b from-white to-slate-100 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
        <h2 className="mb-3 text-xs font-bold tracking-wide text-red-600 uppercase">
          キャラクター変更
        </h2>
        <CharacterPicker selectedCharacterId={staff.selectedCharacterId} />
      </section>
    </div>

      <BottomTabBar />
    </main>
  );
}
