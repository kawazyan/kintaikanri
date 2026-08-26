"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteShift } from "./actions";

export function DeleteShiftButton({ shiftId }: { shiftId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!window.confirm("このシフトを削除しますか?")) return;
    startTransition(async () => {
      const result = await deleteShift(shiftId);
      if ("error" in result) {
        window.alert(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition active:scale-95 disabled:opacity-50"
    >
      <Trash2 size={12} />
      {pending ? "削除中..." : "削除"}
    </button>
  );
}
