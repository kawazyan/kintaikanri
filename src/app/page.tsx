import { redirect } from "next/navigation";
import { Clock3 } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IdentifyForm } from "./identify-form";

export default async function Home() {
  const staffId = await getStaffId();
  if (staffId) {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (staff && staff.status === "ACTIVE") {
      redirect("/clock");
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#f6f5f2] text-[#2d3540]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] bg-[radial-gradient(circle_at_50%_0%,rgba(238,118,64,.12),transparent_62%)]" />
      <div className="pointer-events-none absolute -left-24 top-[20%] h-56 w-56 rounded-full bg-white/70 blur-3xl" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(40px,env(safe-area-inset-top))]">
        <div className="flex flex-1 items-center justify-center py-8">
          <section className="w-full animate-[loginFade_.4s_ease-out]">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-5 flex h-[58px] w-[58px] items-center justify-center rounded-[19px] bg-[#ea692d] shadow-[0_10px_28px_rgba(234,105,45,.20)]">
                <Clock3 className="h-7 w-7 text-white" strokeWidth={2.1} />
              </div>
              <p className="text-[11px] font-extrabold tracking-[0.24em] text-[#b19789]">K.J SYSTEM</p>
              <h1 className="mt-2 text-[29px] font-bold tracking-[-0.045em] text-[#303743]">勤怠管理</h1>
              <p className="mt-2 text-[13px] leading-6 text-[#7d8792]">社員コードでログインしてください</p>
            </div>

            <div className="rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_18px_50px_rgba(54,47,42,.09)] backdrop-blur-sm sm:p-6">
              <IdentifyForm />
            </div>
          </section>
        </div>

        <footer className="pb-1 text-center text-[10px] font-medium tracking-[0.08em] text-[#b2aaa4]">
          K.J GROUP · ATTENDANCE SYSTEM
        </footer>
      </div>
    </main>
  );
}
