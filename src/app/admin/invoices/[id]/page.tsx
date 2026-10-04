import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { invoiceRecipients } from "@/lib/invoice-defaults";
import { AdminNav } from "../../admin-nav";
import { ApproveButtons } from "./approve-buttons";

const STATUS_LABEL: Record<string, string> = { DRAFT: "下書き（承認待ち）", FINALIZED: "確定・送信済み", REISSUED: "再発行・送信済み" };

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const i = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!i) notFound();

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

      {i.sentAt && (
        <p className="mt-3 rounded-xl border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-300">
          {formatJst(i.sentAt)} にメール送信済み（{i.sentTo}）
        </p>
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
          <iframe src={`/invoice/${i.id}/pdf`} title="請求書プレビュー" className="h-[680px] w-full rounded-xl bg-white" />
        </section>
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-black">稼働明細書</h2>
            <Link href={`/invoice/${i.id}/statement`} target="_blank" className="text-sm text-blue-400 underline">別タブで開く</Link>
          </div>
          <iframe src={`/invoice/${i.id}/statement`} title="稼働明細書プレビュー" className="h-[680px] w-full rounded-xl bg-white" />
        </section>
      </div>

      {i.status === "DRAFT" ? (
        <ApproveButtons invoiceId={i.id} recipients={recipients} total={i.totalInclTax} />
      ) : (
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/invoice/${i.id}/print`} className="rounded-xl bg-white px-4 py-3 font-black text-slate-900">請求書を開く</Link>
          <Link href={`/invoice/${i.id}/pdf`} className="rounded-xl bg-emerald-600 px-4 py-3 font-black">請求書PDF</Link>
          <Link href={`/invoice/${i.id}/statement`} className="rounded-xl bg-blue-600 px-4 py-3 font-black">稼働明細書PDF</Link>
          <Link href={`/invoice/${i.id}/detail`} className="rounded-xl border border-slate-600 px-4 py-3 font-black">勤務・請求明細書</Link>
        </div>
      )}
    </main>
  );
}
