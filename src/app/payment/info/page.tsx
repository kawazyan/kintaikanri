import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/bottom-tab-bar";

export default async function PaymentInfoPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  return (
    <main className="staff-screen min-h-dvh text-slate-100">
      <div className="mx-auto max-w-[430px] px-4 pb-28 pt-[calc(72px_+_env(safe-area-inset-top))]">
        <div className="flex items-center gap-3 py-3">
          <Link href="/clock" className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/30" aria-label="ホームへ戻る">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] font-black tracking-[.16em] text-slate-500">PAYMENT ACCOUNT</p>
            <h1 className="text-xl font-black">支払情報</h1>
          </div>
        </div>

        <section className="mt-4 rounded-[20px] border border-white/10 bg-black/25 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-500">支払方式</p>
              <p className="mt-1 font-black">{staff.paymentMethod === "FIXED" ? "固定支払" : "申請支払"}</p>
            </div>
            <Link href="/payment/history" className="rounded-xl border border-white/15 px-3 py-2 text-xs font-black">振込履歴を見る</Link>
          </div>
        </section>
      </div>
      <BottomTabBar />
    </main>
  );
}
