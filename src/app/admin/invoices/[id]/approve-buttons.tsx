"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { approveInvoice } from "../actions";

export function ApproveButtons({
  invoiceId,
  recipients,
  total,
}: {
  invoiceId: string;
  recipients: string;
  total: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function approve() {
    setMessage(null);
    if (!name.trim()) {
      setMessage({ ok: false, text: "承認者名を入力してください。" });
      return;
    }
    if (!window.confirm(`請求書と稼働明細書（税込 ¥${total.toLocaleString("ja-JP")}）を\n${recipients}\nへメール送信して確定します。よろしいですか？`)) return;
    startTransition(async () => {
      const res = await approveInvoice(invoiceId, name);
      if (res.ok) {
        setMessage({ ok: true, text: res.message });
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="mt-5 rounded-2xl border border-red-900 bg-red-950/20 p-5">
      <p className="text-sm text-slate-300">内容を確認して、「承認」か「修正」を選んでください。</p>
      <p className="mt-1 text-xs text-slate-500">送信先: {recipients}</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="承認者名"
        className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2"
      />
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={approve}
          disabled={pending}
          className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white disabled:opacity-50"
        >
          {pending ? "送信中..." : "承認（PDFをメール送信）"}
        </button>
        <Link href={`/admin/invoices/${invoiceId}/edit`} className="rounded-xl border border-slate-500 px-6 py-3 font-black text-slate-100">
          修正
        </Link>
      </div>
      {message && (
        <p className={`mt-3 text-sm font-bold ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
      )}
    </div>
  );
}
