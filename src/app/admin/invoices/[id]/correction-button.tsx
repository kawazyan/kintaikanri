"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCorrection } from "../actions";

// 送付済みの請求から訂正版(下書き)を作る。送付済みの請求は変更しない。
export function CorrectionButton({ invoiceId, invoiceNumber }: { invoiceId: string; invoiceNumber: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    if (!window.confirm(`${invoiceNumber} の訂正版（下書き）を作ります。\n送付済みの請求は変更されません。よろしいですか？`)) return;
    startTransition(async () => {
      const res = await createCorrection(invoiceId);
      if (res.ok) router.push(`/admin/invoices/${res.id}`);
      else setError(res.error);
    });
  }

  return (
    <div className="mt-5 rounded-2xl border border-amber-700 bg-amber-950/30 p-4">
      <p className="font-black text-amber-200">請求書を訂正する</p>
      <p className="mt-1 text-sm text-amber-200/80">
        取引先から訂正の依頼があったときは、訂正版（下書き）を作って直します。承認して送信すると、メールの件名・本文に「訂正」と入ります。
      </p>
      <button type="button" disabled={pending} onClick={run} className="mt-3 rounded-xl bg-amber-500 px-4 py-3 font-black text-slate-900 disabled:opacity-60">
        {pending ? "作成中..." : "訂正版を作成"}
      </button>
      {error && <p className="mt-2 text-sm font-bold text-red-300">{error}</p>}
    </div>
  );
}
