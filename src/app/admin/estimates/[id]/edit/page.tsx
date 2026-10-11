import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceRecipients } from "@/lib/invoice-defaults";
import { AdminNav } from "../../../admin-nav";
import { EstimateForm } from "../../estimate-form";

export default async function EditEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const e = await prisma.estimate.findUnique({ where: { id }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  if (!e) notFound();
  if (e.status !== "SAVED") redirect(`/admin/estimates/${id}`);

  const [clients, admins] = await Promise.all([
    // 取引先が無効になっていても、この見積書の取引先は選べるようにする。
    prisma.client.findMany({ where: { OR: [{ active: true }, { id: e.clientId }] }, orderBy: { name: "asc" } }),
    prisma.adminEmail.findMany({ select: { email: true } }),
  ]);
  const cc = admins.length ? `（CC: ${admins.map((a) => a.email).join(", ")}）` : "";
  const incl = e.taxMode === "INCL";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-slate-100">
      <AdminNav />
      <Link href={`/admin/estimates/${id}`} className="text-sm text-blue-400 underline">← 見積書へ戻る</Link>
      <h1 className="mt-3 text-2xl font-black">見積書の修正</h1>
      <EstimateForm
        existingId={id}
        existingNumber={e.estimateNumber}
        clients={clients.map((c) => {
          const to = invoiceRecipients(c).join(", ");
          return { id: c.id, name: c.name, recipients: to ? `${to}${cc}` : "" };
        })}
        initial={{
          clientId: e.clientId,
          issuedDate: e.issuedDate,
          addressee: e.addressee,
          subject: e.subject,
          note: e.note ?? "",
          taxMode: incl ? "INCL" : "EX",
          // 税込で入力した見積書は、入力した税込の単価を入力欄に出す。
          lines: e.lines.map((l) => ({ label: l.label, description: l.description ?? "", quantity: l.quantity, unitPrice: incl ? (l.unitPriceInclTax ?? l.unitPriceExTax) : l.unitPriceExTax })),
        }}
      />
    </main>
  );
}
