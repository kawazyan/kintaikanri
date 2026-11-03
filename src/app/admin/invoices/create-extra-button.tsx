"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExtraInvoice } from "./actions";

// 別途請求(営業協力費など、スタッフの稼働とは別の請求)を、既存の取引先に新しく作る。作成後は「修正」画面で金額などを入力する。
export function CreateExtraInvoiceButton({ clients }: { clients: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          if (!String(fd.get("clientId") || "") || !String(fd.get("yearMonth") || "") || !String(fd.get("label") || "").trim()) {
            setError("取引先・対象月・品目名を入力してください。");
            return;
          }
          const res = await createExtraInvoice(fd);
          if (res.ok) router.push(`/admin/invoices/${res.id}/edit`);
          else setError(res.error);
        })
      }
      noValidate
      className="rounded-2xl border border-amber-500/60 bg-slate-900 p-5"
    >
      <p className="font-black">別途請求を作成（営業協力費など）</p>
      <p className="mt-1 text-xs text-slate-400">スタッフの稼働とは別の請求です。稼働分の請求とは別の請求書になり、請求内訳書（稼働明細書）は付きません。作成後の画面で、金額と送信先を入力します。</p>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px_1fr_auto]">
        <select name="clientId" className="rounded-xl bg-slate-800 px-3 py-2">
          <option value="">取引先を選択</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="month" name="yearMonth" className="rounded-xl bg-slate-800 px-3 py-2" />
        <input name="label" maxLength={40} placeholder="品目名（例: 営業協力費）" className="rounded-xl bg-slate-800 px-3 py-2 placeholder:!text-slate-500" />
        <button disabled={pending} className="rounded-xl bg-amber-500 px-5 py-2 font-black text-slate-900 disabled:opacity-50">
          {pending ? "作成中…" : "別途請求を作成"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm font-bold text-red-400">{error}</p>}
    </form>
  );
}
