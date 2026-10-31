"use client";

import { useFormStatus } from "react-dom";

export function DeleteExpenseButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(`「${label}」を削除します。元に戻せません。よろしいですか?`)) e.preventDefault();
      }}
      className="rounded-md border border-[#f87171] px-2 py-1 text-xs font-bold text-[#b91c1c] disabled:opacity-50"
    >
      {pending ? "…" : "削除"}
    </button>
  );
}
