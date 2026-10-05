"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInvoice } from "../actions";

// 確定済み・送付済みの請求の削除。請求番号を入力して確認した場合だけ削除する。
export function DeleteSentInvoiceButton({
  invoiceId,
  invoiceNumber,
  clientName,
  total,
  sent,
}: {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  total: number;
  sent: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    const typed = window.prompt(
      `${clientName} の請求（税込 ¥${total.toLocaleString("ja-JP")}）を削除します。元に戻せません。\n` +
        (sent ? "この請求は、取引先へ送付した記録があります。記録も消えます。\n" : "") +
        `削除する場合は、請求番号「${invoiceNumber}」を入力してください。`
    );
    if (typed === null) return;
    startTransition(async () => {
      const res = await deleteInvoice(invoiceId, typed);
      if (res.ok) router.push("/admin/invoices");
      else setError(res.error);
    });
  }

  return (
    <div className="mt-5">
      <button type="button" onClick={remove} disabled={pending} className="rounded-xl border border-red-700 px-6 py-3 font-black text-red-300 disabled:opacity-50">
        {pending ? "削除中..." : "削除"}
      </button>
      {error && <p className="mt-3 text-sm font-bold text-red-400">{error}</p>}
    </div>
  );
}
