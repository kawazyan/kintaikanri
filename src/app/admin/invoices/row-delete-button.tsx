"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInvoice } from "./actions";

// 一覧の各行の削除ボタン。下書き・承認済みは確認だけ。確定済み・送付済みは請求番号の入力が必要。
export function RowDeleteButton({
  id,
  invoiceNumber,
  clientName,
  total,
  needsNumber,
  sent,
}: {
  id: string;
  invoiceNumber: string;
  clientName: string;
  total: number;
  needsNumber: boolean;
  sent: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    const base = `${clientName}（${invoiceNumber}）の請求（税込 ¥${total.toLocaleString("ja-JP")}）を削除します。元に戻せません。`;
    let typed: string | undefined;
    if (needsNumber) {
      const input = window.prompt(
        `${base}\n${sent ? "この請求は、取引先へ送付した記録があります。記録も消えます。\n" : ""}削除する場合は、請求番号「${invoiceNumber}」を入力してください。`
      );
      if (input === null) return;
      typed = input;
    } else if (!window.confirm(`${base}\nよろしいですか？`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteInvoice(id, typed);
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
