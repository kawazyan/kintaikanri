import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { AdminNav } from "../admin-nav";
import { CreateInvoiceButton } from "./create-button";
import { CreateExtraInvoiceButton } from "./create-extra-button";
import { isExtraInvoice } from "@/lib/invoice-kind";
import { InvoiceRowCard, type InvoiceRow } from "./invoice-row-card";
import { SentInvoices } from "./sent-invoices";

function Section({ title, hint, rows, empty }: { title: string; hint: string; rows: InvoiceRow[]; empty: string }) {
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-black">{title}</h2>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-black text-slate-300">{rows.length}</span>
        <span className="text-xs text-slate-500">{hint}</span>
      </div>
      <div className="mt-3 space-y-3">
        {rows.length === 0 && <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">{empty}</p>}
        {rows.map((r) => (
          <InvoiceRowCard key={r.id} r={r} />
        ))}
      </div>
    </section>
  );
}

export default async function InvoicesPage() {
  await requireAdmin();
  const [clients, invoices] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.invoice.findMany({ include: { client: true }, orderBy: { createdAt: "desc" }, take: 300 }),
  ]);

  const toRow = (i: (typeof invoices)[number], note: string): InvoiceRow => ({
    id: i.id,
    clientName: i.client.name,
    yearMonth: i.yearMonth,
    invoiceNumber: i.invoiceNumber,
    total: i.totalInclTax,
    note,
    needsNumber: i.status !== "DRAFT" && i.status !== "APPROVED",
    sent: !!i.sentAt,
    extra: isExtraInvoice(i.kind),
  });

  const drafts = invoices.filter((i) => i.status === "DRAFT").map((i) => toRow(i, `作成 ${formatJst(i.createdAt)}`));
  const approved = invoices
    .filter((i) => i.status === "APPROVED")
    .map((i) => toRow(i, `承認 ${i.approvedAt ? formatJst(i.approvedAt) : ""}${i.approvedBy ? `（${i.approvedBy}）` : ""}`));
  const sent = invoices
    .filter((i) => i.status === "FINALIZED" || i.status === "REISSUED")
    .sort((a, b) => ((b.sentAt ?? b.finalizedAt ?? b.createdAt).getTime()) - ((a.sentAt ?? a.finalizedAt ?? a.createdAt).getTime()))
    .map((i) => toRow(i, `送付 ${formatJst((i.sentAt ?? i.finalizedAt ?? i.createdAt))}`));

  return (
    <main className="kj-invoices-page mx-auto max-w-5xl px-4 py-8 text-slate-100">
      <AdminNav />
      <h1 className="text-2xl font-black">請求管理</h1>
      <p className="mt-1 text-sm text-slate-400">毎月1日に、契約が登録されている取引先の前月分の下書きが自動で作られます（稼働がない取引先は作られません）。下書き → 承認 → 送信 の順に進めます。</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/admin/estimates/new" className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white">見積書を作成</Link>
        <Link href="/admin/estimates" className="rounded-xl border border-slate-500 px-5 py-3 font-black text-slate-100">見積書の一覧</Link>
      </div>
      <div className="mt-5">
        <CreateInvoiceButton clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
      <div className="mt-4">
        <CreateExtraInvoiceButton clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
      <Section title="下書き" hint="内容を確認して「承認」" rows={drafts} empty="下書きはありません。" />
      <Section title="承認済み" hint="「送信」でメール送付" rows={approved} empty="承認済みで未送信の請求はありません。" />
      <SentInvoices rows={sent} />
    </main>
  );
}
