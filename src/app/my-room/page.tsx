import { redirect } from "next/navigation";
import { Sparkles, Sofa, Palette, CheckCircle2 } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { PageHeader } from "@/components/page-header";
import { CharacterPicker } from "./character-picker";
import { NameEditor } from "./name-editor";

export default async function MyRoomPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  return (
    <main className="staff-screen">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28">
        <PageHeader icon={Sofa} title="マイルーム" eyebrow={`${staff.name} さん`} />

        <NameEditor name={staff.name} />

        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#f8c85f] via-[#f59e0b] to-[#ea580c] p-5 text-white shadow-[0_12px_28px_rgba(234,88,12,.22)] ring-1 ring-white/20">
          <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
          <span className="relative flex h-11 w-11 items-center justify-center rounded-[15px] bg-white/16 ring-1 ring-white/20 backdrop-blur-sm">
            <Sparkles size={23} />
          </span>
          <h2 className="relative mt-3 text-[21px] font-black tracking-tight">自分らしいホーム画面に</h2>
          <p className="relative mt-1 max-w-[290px] text-xs font-semibold leading-relaxed text-white/85">
            キャラクターを選ぶと、出勤前・勤務中・退勤後のホーム演出に反映されます。
          </p>
        </section>

        <section className="rounded-[26px] bg-white p-4 shadow-[0_9px_26px_rgba(15,23,42,.07)] ring-1 ring-black/[.04]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-amber-50 ring-1 ring-amber-100">
                <Palette size={20} className="text-amber-600" />
              </span>
              <div>
                <p className="text-[10px] font-black tracking-[.12em] text-amber-600">CHARACTER</p>
                <h2 className="mt-0.5 text-sm font-black text-slate-900">キャラクター変更</h2>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-700 ring-1 ring-emerald-100">
              <CheckCircle2 size={10} /> 即時反映
            </span>
          </div>
          <CharacterPicker
            selectedCharacterId={staff.selectedCharacterId}
            customAvatars={{
              home: staff.customAvatarHome,
              work: staff.customAvatarWork,
              night: staff.customAvatarNight,
            }}
          />
        </section>
      </div>
      <BottomTabBar />
    </main>
  );
}
