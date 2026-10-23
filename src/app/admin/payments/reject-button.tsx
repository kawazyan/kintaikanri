"use client";

import { useFormStatus } from "react-dom";

// 振込申請の「却下」ボタン。取り消しはできないので、押す前に確認を出す。
export function RejectButton({ staffName, amount }: { staffName: string; amount: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(`${staffName}さんの振込申請(${amount.toLocaleString("ja-JP")}円)を却下します。却下すると元に戻せません。よろしいですか？`)) {
          e.preventDefault();
        }
      }}
      className="rounded-md border border-red-500/60 px-2 py-1 text-xs font-semibold text-red-400 active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "処理中…" : "却下"}
    </button>
  );
}
