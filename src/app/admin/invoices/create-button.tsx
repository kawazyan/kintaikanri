"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvoiceDraft } from "./actions";

// branches: 取引先に登録してある請求先(店舗)。あれば、店舗を選ぶと宛名・送信先が自動で入る。
export function CreateInvoiceButton({ clients }: { clients: { id: string; name: string; branches: string[] }[] }) {
  const [clientId, setClientId] = useState("");
  const branches = clients.find((c) => c.id === clientId)?.branches ?? [];
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          // ブラウザ標準の「値を入力してください」の吹き出しは使わず、画面のメッセージで案内する。
          if (!String(fd.get("clientId") || "") || !String(fd.get("yearMonth") || "")) {
            setError("取引先と対象月を選んでください。");
            return;
          }
          if (branches.length && !String(fd.get("branch") || "")) {
            setError("請求先（店舗）を選んでください（会社あてで作る場合は「店舗を指定しない」を選びます）。");
            return;
          }
          const res = await createInvoiceDraft(fd);
          if (res.ok) router.push(`/admin/invoices/${res.id}`);
          else setError(res.error);
        })
      }
      noValidate
      className="rounded-2xl border border-slate-700 bg-slate-900 p-5"
    >
      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <select name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} className="rounded-xl bg-slate-800 px-3 py-2">
          <option value="">取引先を選択</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="month" name="yearMonth" className="rounded-xl bg-slate-800 px-3 py-2" />
        <button disabled={pending} className="rounded-xl bg-blue-600 px-5 py-2 font-black text-white disabled:opacity-50">
          {pending ? "作成中…" : "請求下書きを作成"}
        </button>
      </div>
      {branches.length > 0 && (
        <div className="mt-3">
          <select key={clientId} name="branch" defaultValue="" className="w-full rounded-xl bg-slate-800 px-3 py-2 md:w-auto md:min-w-[260px]">
            <option value="">請求先（店舗）を選択</option>
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
            <option value="__NONE__">店舗を指定しない（会社あて）</option>
          </select>
          <p className="mt-1 text-xs text-slate-400">店舗を選ぶと、宛名（会社名＋店舗名）と送信先が自動で入り、前の月の同じ店舗の請求の品目・金額を引き継ぎます。</p>
        </div>
      )}
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
