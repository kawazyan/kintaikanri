import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { invoiceRecipients } from "@/lib/invoice-defaults";
import { resolveEstimateRecipients } from "@/lib/estimate";
import { AdminNav } from "../../admin-nav";
import { PdfPreview } from "../../invoices/[id]/pdf-preview";
import { EstimateActions } from "./estimate-actions";

const STATUS_LABEL: Record<string, string> = { SAVED: "保存済み（未送付）", SENT: "送付済み" };

export default async function EstimateDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const e = await prisma.estimate.findUnique({ where: { id }, include: { client: true, lines: { orderBy: { sortOrder: "asc" } } } });
  if (!e) notFound();

  const admins = await prisma.adminEmail.findMany({ select: { email: true } });
  // 送信先: 見積書に手入力した送信先メールアドレスがあればそれ、なければ取引先の登録。
  const to = resolveEstimateRecipients(e.recipientEmails, e.client ? invoiceRecipients(e.client) : []).join(", ");
  const recipients = to ? `${to}${admins.length ? `（CC: ${admins.map((a) => a.email).join(", ")}）` : ""}` : "";
  const title = [e.client?.name || e.addressee, e.storeName, e.subject].filter(Boolean).join(" / ") || "（内容未入力）";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-100">
      <AdminNav />
      <Link href="/admin/estimates" className="text-sm text-blue-400 underline">← 見積書の一覧へ戻る</Link>
      <div className="mt-3 flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{e.estimateNumber}</p>
          <h1 className="text-2xl font-black">
            {title}
          </h1>
          <p className="mt-1 text-xs text-slate-500">発行日 {e.issuedDate}</p>
        </div>
        <span className="h-fit rounded-full bg-slate-800 px-3 py-1 text-xs font-black">{STATUS_LABEL[e.status] ?? e.status}</span>
      </div>

      {e.status === "SENT" && (
        <p className="mt-3 rounded-xl border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-300">
          {e.sentAt ? formatJst(e.sentAt) : ""} に送付済み{e.sentTo ? `（${e.sentTo}）` : ""}
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
            {e.lines.map((l) => (
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
              <td>¥{e.subtotalExTax.toLocaleString()} / ¥{e.taxAmount.toLocaleString()}</td>
            </tr>
            <tr className="border-t border-slate-700">
              <td className="p-4 font-black" colSpan={3}>合計（税込）</td>
              <td className="text-xl font-black">¥{e.totalInclTax.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-black">見積書PDF</h2>
          <Link href={`/estimate/${e.id}/pdf`} target="_blank" className="text-sm text-blue-400 underline">別タブで開く</Link>
        </div>
        <PdfPreview url={`/estimate/${e.id}/pdf?t=${e.updatedAt.getTime()}`} title="見積書" />
      </section>

      <EstimateActions estimateId={e.id} recipients={recipients} total={e.totalInclTax} clientName={e.client?.name || e.addressee || ""} sent={e.status === "SENT"} />
    </main>
  );
}
