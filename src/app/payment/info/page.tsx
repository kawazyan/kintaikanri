import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, ChevronLeft, CreditCard, Landmark, UserRound } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/bottom-tab-bar";

function valueOrUnset(value?: string | null) {
  return value?.trim() || "未設定";
}

export default async function PaymentInfoPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  return (
    <main className="staff-screen min-h-dvh text-slate-100">
      <div className="mx-auto max-w-[430px] px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3 py-3">
          <Link href="/clock" className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/30" aria-label="ホームへ戻る">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] font-black tracking-[.16em] text-slate-500">PAYMENT ACCOUNT</p>
            <h1 className="text-xl font-black">支払情報</h1>
          </div>
        </div>

        <section className="mt-4 overflow-hidden rounded-[24px] border border-slate-600/60 bg-[linear-gradient(145deg,#111d28,#050a0f)] shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_14px_30px_rgba(0,0,0,.42)]">
          <div className="border-b border-white/10 px-5 py-5">
            <p className="text-xs font-bold text-slate-400">現在登録されている振込先</p>
            <p className="mt-1 text-sm font-black text-slate-100">管理者がスタッフ情報に登録している口座情報です。</p>
          </div>
          <div className="space-y-0 px-5 py-2">
            <InfoRow icon={Landmark} label="金融機関" value={valueOrUnset(staff.bankName)} />
            <InfoRow icon={Building2} label="支店名" value={valueOrUnset(staff.bankBranchName)} />
            <InfoRow icon={CreditCard} label="口座番号" value={valueOrUnset(staff.bankAccountNumber)} mono />
            <InfoRow icon={UserRound} label="口座名義" value={valueOrUnset(staff.bankAccountHolder)} />
          </div>
        </section>

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

function InfoRow({ icon: Icon, label, value, mono = false }: { icon: typeof Landmark; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/8 py-4 last:border-0">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.035] text-slate-300"><Icon size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold text-slate-500">{label}</span>
        <strong className={`mt-1 block break-all text-[15px] text-slate-100 ${mono ? "font-mono tracking-[.08em]" : "font-black"}`}>{value}</strong>
      </span>
    </div>
  );
}
