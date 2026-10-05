"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvoiceDraft } from "./actions";

export function CreateInvoiceButton({ clients }: { clients: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          const res = await createInvoiceDraft(fd);
          if (res.ok) router.push(`/admin/invoices/${res.id}`);
          else setError(res.error);
        })
      }
      className="rounded-2xl border border-slate-700 bg-slate-900 p-5"
    >
      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <select name="clientId" required className="rounded-xl bg-slate-800 px-3 py-2">
          <option value="">取引先を選択</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="month" name="yearMonth" required className="rounded-xl bg-slate-800 px-3 py-2" />
        <button disabled={pending} className="rounded-xl bg-red-600 px-5 py-2 font-black">
          {pending ? "作成中…" : "請求下書きを作成"}
        </button>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" name="carryOver" defaultChecked className="mt-1" />
        <span>
          前の下書き（未送信）の追加・修正を引き継ぐ
          <span className="block text-xs text-slate-500">追加したスタッフ、直した金額・稼働日・店舗・共通項目、宛名・件名・備考を、新しい下書きに反映します。</span>
        </span>
      </label>
      {error && <p className="mt-3 text-sm font-bold text-red-400">{error}</p>}
    </form>
  );
}
