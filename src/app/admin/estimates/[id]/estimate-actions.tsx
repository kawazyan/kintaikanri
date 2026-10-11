"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteEstimate, sendEstimate, type EstimateActionResult } from "../actions";

// 保存済み(未送付)の見積書: 送付 / 修正 / 削除。メールは「送付」を押したときだけ送られる。
export function EstimateActions({ estimateId, recipients, total, clientName }: { estimateId: string; recipients: string; total: number; clientName: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<EstimateActionResult>, after?: () => void) {
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

  function send() {
    if (!window.confirm(`見積書（税込 ¥${total.toLocaleString("ja-JP")}）を\n${recipients || "（取引先のメールアドレス未登録）"}\nへメール送付します。よろしいですか？`)) return;
    run(() => sendEstimate(estimateId));
  }
  function remove() {
    if (!window.confirm(`${clientName} の見積書（税込 ¥${total.toLocaleString("ja-JP")}）を削除します。元に戻せません。よろしいですか？`)) return;
    run(() => deleteEstimate(estimateId), () => router.push("/admin/estimates"));
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <p className="text-sm text-slate-300">保存済みです。メールはまだ送られていません。「送付」を押すと取引先へメールで送ります。</p>
      <p className="mt-1 text-xs text-slate-500">送付先: {recipients || "（取引先のメールアドレス未登録）"}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={send} disabled={pending} className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white disabled:opacity-50">
          {pending ? "処理中..." : "送付（メールで送る）"}
        </button>
        <Link href={`/admin/estimates/${estimateId}/edit`} className="rounded-xl border border-slate-500 px-6 py-3 font-black text-slate-100">
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
