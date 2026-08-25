"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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
      className="text-xs text-red-700 underline disabled:opacity-50"
    >
      {pending ? "削除中..." : "削除"}
    </button>
  );
}
