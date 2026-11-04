import Link from "next/link";
import { findPreviewInvoice } from "@/lib/amount-entry-server";
import { SendPreparedForm } from "./send-form";
import { PdfPages } from "./pdf-pages";

export const metadata = { title: "請求内容の確認", robots: { index: false, follow: false } };

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const cardClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const thClass = "border-b border-slate-200 px-2 py-2 text-left text-xs font-bold text-slate-600";
const tdClass = "border-b border-slate-100 px-2 py-2 text-sm text-slate-900";
const dayLabel = (d: string) => new Date(`${d}T00:00:00+09:00`).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });

// 送信前の確認画面。PDFを開かなくても、請求の中身と明細(稼働日・店舗・キャリア)が見える。
// 同じ内容のPDF(請求書・明細書)は下のリンクから開ける。
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
          <h2 className="text-base font-black text-slate-900">請求書</h2>
          <div className="mt-3">
            <PdfPages src={`${base}/invoice`} title="請求書" />
          </div>
        </section>

        <section className={`${cardClass} mt-5`}>
          <h2 className="text-base font-black text-slate-900">明細書</h2>
          <div className="mt-3">
            <PdfPages src={`${base}/statement`} title="明細書" />
          </div>
        </section>

        <section className={`${cardClass} mt-5`}>
          <div className="mt-1">
            <SendPreparedForm token={token} invoiceId={id} yearMonth={invoice.yearMonth} />
          </div>
          <Link href={`/amount/${token}?m=${invoice.yearMonth}`} className="mt-4 block text-center text-sm font-bold text-slate-700 underline">
            金額を直す
          </Link>
          <p className="mt-4 text-xs text-slate-600">
            PDFで確認する場合: <a className="font-bold text-[#233f65] underline" href={`${base}/invoice`} target="_blank" rel="noopener">請求書PDF</a> ／ <a className="font-bold text-[#233f65] underline" href={`${base}/statement`} target="_blank" rel="noopener">明細書PDF</a>
          </p>
        </section>
      </main>
    </div>
  );
}
