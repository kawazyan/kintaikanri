import Link from "next/link";
import { findPreviewInvoice } from "@/lib/amount-entry-server";
import { SendPreparedForm } from "./send-form";

export const metadata = { title: "請求内容の確認", robots: { index: false, follow: false } };

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const cardClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

export default async function PreviewPage({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const found = await findPreviewInvoice(token, id);
  if (!found) {
    return (
      <div className="admin-theme min-h-dvh">
        <main className="mx-auto max-w-md px-4 py-10">
          <h1 className="kj-page-title">この請求は確認できません</h1>
          <p className="mt-3 text-sm text-slate-700">送信済みか、リンクが無効です。管理者に確認してください。</p>
        </main>
      </div>
    );
  }
  const { invoice, client } = found;
  const [y, m] = invoice.yearMonth.split("-");
  const base = `/amount/${token}/pdf/${id}`;
  return (
    <div className="admin-theme min-h-dvh">
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="kj-page-title">{client.name}　請求内容の確認</h1>
        <p>内容を確認して「この内容で送信する」を押すと、請求書と明細書が取引先へ届きます。送信は取り消せません。</p>

        <section className={`${cardClass} mt-5`}>
          <h2 className="text-base font-black text-slate-900">{y}年{Number(m)}月分</h2>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <dt className="font-bold text-slate-600">税抜</dt>
            <dd className="col-span-2 font-black text-slate-900">{yen(invoice.subtotalExTax)}</dd>
            <dt className="font-bold text-slate-600">消費税</dt>
            <dd className="col-span-2 text-slate-900">{yen(invoice.taxAmount)}</dd>
            <dt className="font-bold text-slate-600">税込</dt>
            <dd className="col-span-2 font-black text-slate-900">{yen(invoice.totalInclTax)}</dd>
          </dl>
          <div className="mt-5">
            <SendPreparedForm token={token} invoiceId={id} yearMonth={invoice.yearMonth} />
          </div>
          <Link href={`/amount/${token}?m=${invoice.yearMonth}`} className="mt-4 block text-center text-sm font-bold text-slate-700 underline">
            金額を直す
          </Link>
        </section>

        <section className={`${cardClass} mt-5`}>
          <h2 className="text-base font-black text-slate-900">請求書</h2>
          <p className="mt-1 text-sm"><a className="font-bold text-[#233f65] underline" href={`${base}/invoice`} target="_blank" rel="noopener">PDFを開く</a></p>
          <iframe src={`${base}/invoice`} title="請求書" className="mt-3 h-[70vh] w-full rounded-xl border border-slate-200 bg-white" />
        </section>

        <section className={`${cardClass} mt-5`}>
          <h2 className="text-base font-black text-slate-900">明細書</h2>
          <p className="mt-1 text-sm"><a className="font-bold text-[#233f65] underline" href={`${base}/statement`} target="_blank" rel="noopener">PDFを開く</a></p>
          <iframe src={`${base}/statement`} title="明細書" className="mt-3 h-[70vh] w-full rounded-xl border border-slate-200 bg-white" />
        </section>
      </main>
    </div>
  );
}
