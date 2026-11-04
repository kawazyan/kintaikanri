import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recipientPresetsOf, type BillingTerms } from "@/lib/billing-terms";
import { AdminNav } from "../../../admin-nav";
import { BranchesEditor } from "./branches-editor";

export default async function BranchesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, select: { id: true, name: true, billingTerms: true } });
  if (!client) notFound();
  const branches = recipientPresetsOf(client.billingTerms as BillingTerms | null);

  return <main className="mx-auto max-w-4xl px-4 py-8 text-slate-900"><AdminNav />
    <Link href="/admin/clients" className="text-sm font-black text-slate-500 underline">← 取引先・依頼窓口へ戻る</Link>
    <div className="mt-3 rounded-[28px] bg-[#14283b] p-6 text-white">
      <p className="text-[11px] font-black tracking-[.18em] text-slate-300">BILLING TARGETS</p>
      <h1 className="mt-2 text-2xl font-black">{client.name} の請求先（店舗ごとの宛先）</h1>
      <p className="mt-2 text-sm font-bold text-slate-300">同じ会社でも店舗（部署・エリア）ごとに請求書の宛先が違うときに登録します。請求管理の「請求下書きを作成」で店舗を選ぶと、宛名（会社名＋店舗名）と送信先が自動で入り、前の月の同じ店舗の請求の品目・金額も引き継ぎます。請求書は店舗ごとに別々になり、別の店舗の請求が「訂正」扱いになることはありません。</p>
    </div>
    <section className="mt-6"><BranchesEditor clientId={client.id} initial={branches.map((b) => ({ label: b.label, emails: b.emails.join("\n") }))} /></section>
  </main>;
}
