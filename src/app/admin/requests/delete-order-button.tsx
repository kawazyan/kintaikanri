"use client";

import { Trash2 } from "lucide-react";
import { deleteOrder } from "./actions";

export function DeleteOrderButton({ id, compact = false }: { id: string; compact?: boolean }) {
  return (
    <form
      action={deleteOrder.bind(null, id)}
      onSubmit={(e) => {
        if (!window.confirm("この稼働依頼を完全に削除します。誤送信など不要な案件だけ削除してください。元に戻せません。削除しますか？")) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className={compact
          ? "inline-flex items-center gap-1.5 rounded-lg border border-red-800/80 bg-red-950/25 px-3 py-2 text-xs font-black text-red-300"
          : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-700 bg-red-950/35 px-4 py-3 text-sm font-black text-red-300"}
      >
        <Trash2 size={compact ? 14 : 17} />
        案件を削除
      </button>
    </form>
  );
}
