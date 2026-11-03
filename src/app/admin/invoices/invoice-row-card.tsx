import Link from "next/link";
import { RowDeleteButton } from "./row-delete-button";

export type InvoiceRow = {
  id: string;
  clientName: string;
  yearMonth: string;
  invoiceNumber: string;
  total: number;
  note: string;
  needsNumber: boolean; // 確定済み・送付済み(削除に請求番号の入力が必要)
  sent: boolean; // メールを送付した記録がある
  extra: boolean; // 新規請求書(営業協力費など、稼働とは別の請求)
};

// 請求管理の一覧の1行(下書き・承認済み・送付済みで共通)。
export function InvoiceRowCard({ r }: { r: InvoiceRow }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <Link href={`/admin/invoices/${r.id}`} className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-black">
            {r.clientName} ・ {r.yearMonth}
            {r.extra && <span className="ml-2 rounded-full bg-slate-600 px-2 py-0.5 text-xs font-black text-white">別途請求</span>}
          </p>
          <p className="text-xs text-slate-400">{r.invoiceNumber} ・ {r.note}</p>
        </div>
        <p className="text-lg font-black">¥{r.total.toLocaleString()}</p>
      </Link>
      <RowDeleteButton id={r.id} invoiceNumber={r.invoiceNumber} clientName={r.clientName} total={r.total} needsNumber={r.needsNumber} sent={r.sent} />
    </div>
  );
}
