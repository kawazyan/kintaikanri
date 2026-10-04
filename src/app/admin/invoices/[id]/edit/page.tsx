import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_INVOICE_NOTE, defaultSubject, invoiceRecipients } from "@/lib/invoice-defaults";
import type { StatementSnapshot } from "@/lib/invoice-draft";
import { AdminNav } from "../../../admin-nav";
import { EditInvoiceForm } from "./edit-form";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const i = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!i) notFound();
  if (i.status !== "DRAFT" && i.status !== "APPROVED") redirect(`/admin/invoices/${id}`);

  const admins = await prisma.adminEmail.findMany({ select: { email: true } });
  const to = invoiceRecipients(i.client).join(", ");
  const recipients = to
    ? `${to}${admins.length ? `（CC: ${admins.map((a) => a.email).join(", ")}）` : ""}`
    : "（取引先のメールアドレス未登録）";
  const statement = i.statement as unknown as StatementSnapshot | null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-slate-100">
      <AdminNav />
      <Link href={`/admin/invoices/${id}`} className="text-sm text-blue-400 underline">← プレビューへ戻る</Link>
      <h1 className="mt-3 text-2xl font-black">
        請求書・稼働明細書の修正　{i.client.name} / {i.yearMonth}
      </h1>
      <p className="mt-1 text-sm text-slate-400">税率（10%）と発行日（稼働月の月末日が自動で入ります）は変更できません。</p>
      <EditInvoiceForm
        invoiceId={id}
        recipients={recipients}
        initial={{
          addressee: i.addressee?.trim() || i.client.name,
          subject: i.subject?.trim() || defaultSubject(i.yearMonth),
          note: i.note?.trim() ? i.note : DEFAULT_INVOICE_NOTE,
          amountExTax: i.subtotalExTax,
          hasStatement: !!statement,
          warnings: statement?.warnings ?? [],
          clientExtras: (statement?.clientExtras ?? []).map((e) => ({ label: e.label, amountExTax: e.amountExTax, calc: e.calc ?? "" })),
          staff: (statement?.staff ?? []).map((s) => ({
            name: s.name,
            places: s.places.join("、"),
            carriers: s.carriers.join("、"),
            dates: s.dates,
            serviceExTax: s.serviceExTax ?? 0,
            serviceCalc: s.serviceCalc ?? "",
            travelInclTax: s.travel.amountInclTax,
            extrasExTax: (s.extras ?? []).reduce((sum, e) => sum + e.amountExTax, 0),
            extrasLabel: (s.extras ?? []).map((e) => e.label).join("、"),
          })),
        }}
        yearMonth={i.yearMonth}
        status={i.status}
      />
    </main>
  );
}
