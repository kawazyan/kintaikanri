"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { approveInvoice, deleteInvoice, sendInvoice } from "../actions";

// 下書き: 承認 / 修正 / 削除 ・ 承認済み: 送信 / 修正 / 削除
export function InvoiceActions({
  invoiceId,
  status,
  recipients,
  total,
  clientName,
}: {
  invoiceId: string;
  status: "DRAFT" | "APPROVED";
  recipients: string;
  total: number;
  clientName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, after?: () => void) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setMessage({ ok: true, text: res.message });
        if (after) after();
        else router.refresh();
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  function approve() {
    if (!name.trim()) return setMessage({ ok: false, text: "承認者名を入力してください。" });
    if (!window.confirm(`${clientName} の請求（税込 ¥${total.toLocaleString("ja-JP")}）を承認します。\nメールはまだ送信されません。よろしいですか？`)) return;
    run(() => approveInvoice(invoiceId, name));
  }
  function send() {
    if (!window.confirm(`請求書と稼働明細書（税込 ¥${total.toLocaleString("ja-JP")}）を\n${recipients}\nへメール送信します。よろしいですか？`)) return;
    run(() => sendInvoice(invoiceId));
  }
  function remove() {
    if (!window.confirm(`${clientName} の請求（税込 ¥${total.toLocaleString("ja-JP")}）を削除します。元に戻せません。よろしいですか？`)) return;
    run(() => deleteInvoice(invoiceId), () => router.push("/admin/invoices"));
  }

  return (
    <div className="mt-5 rounded-2xl border border-red-900 bg-red-950/20 p-5">
      {status === "DRAFT" ? (
        <>
          <p className="text-sm text-slate-300">内容を確認して、「承認」か「修正」を選んでください。承認してもメールはまだ送られません。</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="承認者名"
            className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2"
          />
        </>
      ) : (
        <>
          <p className="text-sm text-slate-300">承認済みです。「送信」を押すと取引先へメールで送付されます。</p>
          <p className="mt-1 text-xs text-slate-500">送信先: {recipients}</p>
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {status === "DRAFT" ? (
          <button type="button" onClick={approve} disabled={pending} className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white disabled:opacity-50">
            {pending ? "処理中..." : "承認"}
          </button>
        ) : (
          <button type="button" onClick={send} disabled={pending} className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white disabled:opacity-50">
            {pending ? "送信中..." : "送信（メールで送付）"}
          </button>
        )}
        <Link href={`/admin/invoices/${invoiceId}/edit`} className="rounded-xl border border-slate-500 px-6 py-3 font-black text-slate-100">
          修正
        </Link>
        <button type="button" onClick={remove} disabled={pending} className="rounded-xl border border-red-700 px-6 py-3 font-black text-red-300 disabled:opacity-50">
          削除
        </button>
      </div>
      {message && <p className={`mt-3 text-sm font-bold ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
    </div>
  );
}
