import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { invoiceRecipients } from "@/lib/invoice-defaults";
import { AdminNav } from "../../admin-nav";
import { InvoiceActions } from "./invoice-actions";
import { DeleteSentInvoiceButton } from "./delete-sent-button";
import { PdfPreview } from "./pdf-preview";
import { AddStaffForm } from "./add-staff-form";
import { CorrectionButton } from "./correction-button";
import { statementBillableExTax, type StatementSnapshot } from "@/lib/invoice-draft";
import { invoiceMismatch } from "@/lib/invoice-consistency";

const STATUS_LABEL: Record<string, string> = { DRAFT: "下書き", APPROVED: "承認済み（未送信）", FINALIZED: "送付済み", REISSUED: "送付済み（再発行）" };

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const i = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!i) notFound();

  const statement = i.statement as unknown as StatementSnapshot | null;
  const warnings = statement?.warnings ?? [];
  const staffOptions =
    i.status === "DRAFT" && statement
      ? (await prisma.staff.findMany({ orderBy: { employeeCode: "asc" }, select: { id: true, name: true, employeeCode: true } })).map((s) => ({ id: s.id, label: `${s.name}（${s.employeeCode}）` }))
      : [];

  const admins = await prisma.adminEmail.findMany({ select: { email: true } });
  const to = invoiceRecipients(i.client).join(", ");
  const recipients = to
    ? `${to}${admins.length ? `（CC: ${admins.map((a) => a.email).join(", ")}）` : ""}`
    : "（取引先のメールアドレス未登録）";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-100">
      <AdminNav />
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{i.invoiceNumber}</p>
          <h1 className="text-2xl font-black">
            {i.client.name} / {i.yearMonth}
          </h1>
        </div>
        <span className="h-fit rounded-full bg-slate-800 px-3 py-1 text-xs font-black">{STATUS_LABEL[i.status] ?? i.status}</span>
      </div>

      {i.approvedAt && (
        <p className="mt-3 text-xs text-slate-400">承認: {formatJst(i.approvedAt)}（{i.approvedBy}）</p>
      )}
      {(i.sentAt || i.finalizedAt) && i.status !== "DRAFT" && i.status !== "APPROVED" && (
        <p className="mt-3 rounded-xl border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-300">
          {formatJst((i.sentAt ?? i.finalizedAt)!)} に送付済み{i.sentTo ? `（${i.sentTo}）` : ""}
        </p>
      )}

      {(i.status === "DRAFT" || i.status === "APPROVED") && warnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-200">
          <p className="font-black">確認してください（下書き作成時の注意）</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {warnings.map((w, n) => (
              <li key={n}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {(i.status === "DRAFT" || i.status === "APPROVED") && invoiceMismatch(i, statement) && (
        <p className="mt-4 rounded-xl border border-red-700 bg-red-950/40 p-3 text-sm font-bold text-red-200">⚠ {invoiceMismatch(i, statement)}</p>
      )}

      {!!statement?.manualLines?.length && statementBillableExTax(statement) !== i.subtotalExTax && (
        <p className="mt-4 rounded-xl border border-amber-700 bg-amber-950/30 p-3 text-sm font-bold text-amber-200">
          ℹ 品目は手入力です（請求書と請求内訳書は同じ表なので金額は一致しています）。手入力の合計（税抜 ¥{i.subtotalExTax.toLocaleString()}）は、自動で計算した金額（税抜 ¥{statementBillableExTax(statement).toLocaleString()}）と違います。</p>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-900">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-slate-800 text-left text-slate-400">
            <tr>
              <th className="p-3">項目</th>
              <th>数量</th>
              <th>単価（税抜）</th>
              <th>金額（税抜）</th>
            </tr>
          </thead>
          <tbody>
            {i.lines.map((l) => (
              <tr key={l.id} className="border-t border-slate-800">
                <td className="p-3">
                  <b>{l.label}</b>
                  {l.description && <p className="mt-1 text-xs text-slate-500">{l.description}</p>}
                </td>
                <td>{l.quantity}</td>
                <td>¥{l.unitPriceExTax.toLocaleString()}</td>
                <td>¥{(l.quantity * l.unitPriceExTax).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-700 text-slate-400">
              <td className="p-3" colSpan={3}>小計 / 消費税（10%）</td>
              <td>¥{i.subtotalExTax.toLocaleString()} / ¥{i.taxAmount.toLocaleString()}</td>
            </tr>
            <tr className="border-t border-slate-700">
              <td className="p-4 font-black" colSpan={3}>合計（税込）</td>
              <td className="text-xl font-black">¥{i.totalInclTax.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-black">請求書</h2>
            <Link href={`/invoice/${i.id}/pdf`} target="_blank" className="text-sm text-blue-400 underline">別タブで開く</Link>
          </div>
          <PdfPreview url={`/invoice/${i.id}/pdf?t=${i.updatedAt.getTime()}`} title="請求書" />
        </section>
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-black">稼働明細書</h2>
            <Link href={`/invoice/${i.id}/statement`} target="_blank" className="text-sm text-blue-400 underline">別タブで開く</Link>
          </div>
          <PdfPreview url={`/invoice/${i.id}/statement?t=${i.updatedAt.getTime()}`} title="稼働明細書" />
        </section>
      </div>

      {i.status === "DRAFT" && statement && <AddStaffForm invoiceId={i.id} staff={staffOptions} />}

      {i.status === "DRAFT" || i.status === "APPROVED" ? (
        <InvoiceActions invoiceId={i.id} status={i.status} recipients={recipients} total={i.totalInclTax} clientName={i.client.name} />
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/invoice/${i.id}/print`} className="rounded-xl bg-white px-4 py-3 font-black text-slate-900">請求書を開く</Link>
            <Link href={`/invoice/${i.id}/pdf`} className="rounded-xl bg-emerald-600 px-4 py-3 font-black">請求書PDF</Link>
            <Link href={`/invoice/${i.id}/statement`} className="rounded-xl bg-blue-600 px-4 py-3 font-black">稼働明細書PDF</Link>
            <Link href={`/invoice/${i.id}/detail`} className="rounded-xl border border-slate-600 px-4 py-3 font-black">勤務・請求明細書</Link>
          </div>
          <CorrectionButton invoiceId={i.id} invoiceNumber={i.invoiceNumber} />
          <DeleteSentInvoiceButton invoiceId={i.id} invoiceNumber={i.invoiceNumber} clientName={i.client.name} total={i.totalInclTax} sent={!!i.sentAt} />
        </>
      )}
    </main>
  );
}
