import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { BillingTerms } from "@/lib/billing-terms";
import { AdminNav } from "../../../admin-nav";
import { ContractsEditor } from "./contracts-editor";
import { setSplitInvoiceLines } from "./actions";

export default async function ContractsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [client, staff] = await Promise.all([
    prisma.client.findUnique({ where: { id }, select: { id: true, name: true, billingTerms: true } }),
    prisma.staff.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!client) notFound();
  const terms = (client.billingTerms ?? {}) as BillingTerms;
  const rules = terms.shiftBilling ?? [];

  return <main className="mx-auto max-w-6xl px-4 py-8 text-slate-900"><AdminNav />
    <Link href="/admin/clients" className="text-sm font-black text-slate-500 underline">← 取引先・依頼窓口へ戻る</Link>
    <div className="mt-3 rounded-[28px] bg-[#14283b] p-6 text-white">
      <p className="text-[11px] font-black tracking-[.18em] text-slate-300">CONTRACTS</p>
      <h1 className="mt-2 text-2xl font-black">{client.name} の契約(早見表)</h1>
      <p className="mt-2 text-sm font-bold text-slate-300">「どのスタッフが、どの店舗で、いくらで」働くかを登録します。シフトはこの表でクライアントに振り分けられ、請求と出退勤の閲覧ページに使われます。同じスタッフ・店舗が2社に当てはまると自動では振り分けず「要確認」になります。</p>
    </div>
    <form key={String(!!terms.splitInvoiceLines)} action={setSplitInvoiceLines.bind(null, client.id)} className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
      <label className="flex items-start gap-3 text-sm font-bold text-slate-800">
        <input type="checkbox" name="splitInvoiceLines" defaultChecked={!!terms.splitInvoiceLines} className="mt-1 h-5 w-5" />
        <span>請求書の品目を分けて表示する（「稼働費用（スタッフ名）」「交通費相当額」など）。チェックなしは「業務委託費一式」1行で、内訳は稼働明細書に載ります。次に作る請求下書きから反映されます。</span>
      </label>
      <button type="submit" className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-black text-white">保存</button>
    </form>
    <section className="mt-6"><ContractsEditor clientId={client.id} rules={rules} staffNames={staff.map((s) => s.name)} /></section>
  </main>;
}
