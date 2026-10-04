import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { BillingTerms } from "@/lib/billing-terms";
import { AdminNav } from "../../../admin-nav";
import { ContractsEditor } from "./contracts-editor";

export default async function ContractsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [client, staff] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { id: true, name: true, billingTerms: true } }),
    prisma.staff.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!client) notFound();
  const rules = ((client.billingTerms ?? {}) as BillingTerms).shiftBilling ?? [];

  return <main className="mx-auto max-w-6xl px-4 py-8 text-slate-900"><AdminNav />
    <Link href="/admin/clients" className="text-sm font-black text-slate-500 underline">← 取引先・依頼窓口へ戻る</Link>
    <div className="mt-3 rounded-[28px] bg-[#14283b] p-6 text-white">
      <p className="text-[11px] font-black tracking-[.18em] text-slate-300">CONTRACTS</p>
      <h1 className="mt-2 text-2xl font-black">{client.name} の契約(早見表)</h1>
      <p className="mt-2 text-sm font-bold text-slate-300">「どのスタッフが、どの店舗で、いくらで」働くかを登録します。シフトはこの表でクライアントに振り分けられ、請求と出退勤の閲覧ページに使われます。同じスタッフ・店舗が2社に当てはまると自動では振り分けず「要確認」になります。</p>
    </div>
    <section className="mt-6"><ContractsEditor clientId={client.id} rules={rules} staffNames={staff.map((s) => s.name)} /></section>
  </main>;
}
