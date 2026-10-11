"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEstimate } from "./actions";

// 一覧の各行の削除ボタン(保存済み・送付済みどちらも)。確認のあとで削除する。
export function RowDeleteButton({ id, estimateNumber, label, total, sent }: { id: string; estimateNumber: string; label: string; total: number; sent: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    const ok = window.confirm(
      `${label ? `${label}（${estimateNumber}）` : estimateNumber}の見積書（税込 ¥${total.toLocaleString("ja-JP")}）を削除します。${sent ? "送付済みの記録も一緒に消えます（相手に送ったメールは取り消せません）。" : ""}元に戻せません。\n\n削除しますか？`
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteEstimate(id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={remove} disabled={pending} className="rounded-xl border border-red-700 px-4 py-2 text-sm font-black text-red-300 disabled:opacity-50">
        {pending ? "削除中..." : "削除"}
      </button>
      {error && <p className="max-w-[220px] text-right text-xs font-bold text-red-400">{error}</p>}
    </div>
  );
}
