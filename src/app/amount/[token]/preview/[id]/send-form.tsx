"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendPreparedInvoice, type SendResult } from "../../actions";

export function SendPreparedForm({ token, invoiceId, yearMonth }: { token: string; invoiceId: string; yearMonth: string }) {
  const router = useRouter();
  const [result, setResult] = useState<SendResult | null>(null);
  const [pending, startTransition] = useTransition();
  const done = result?.ok === true;

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending || done}
        onClick={() =>
          startTransition(async () => {
            const r = await sendPreparedInvoice(token, invoiceId);
            setResult(r);
            // 送信できたら入力画面へ戻る。送信済みの一覧に、今送った請求が並ぶ。
            if (r.ok) router.push(`/amount/${token}?sent=${yearMonth}`);
          })
        }
        className="w-full rounded-xl px-4 py-3 text-base font-black text-white disabled:opacity-40"
        style={{ background: "linear-gradient(145deg,#325783,#0b1c36)" }}
      >
        {pending ? "送信中…" : done ? "送信済み" : "この内容で送信する"}
      </button>
      {result && (
        <p className={`rounded-xl p-3 text-sm font-bold ${result.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
          {result.ok ? result.message : result.error}
        </p>
      )}
    </div>
  );
}
