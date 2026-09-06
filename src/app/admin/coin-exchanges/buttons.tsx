"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateGiftExchange } from "./actions";

export function Buttons({ id }: { id: string }) {
  const [p, setP] = useState(false);
  const router = useRouter();

  async function go(s: "FULFILLED" | "REJECTED") {
    setP(true);
    await updateGiftExchange(id, s);
    setP(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button disabled={p} onClick={() => go("FULFILLED")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">
        送付完了
      </button>
      <button disabled={p} onClick={() => go("REJECTED")} className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-black">
        却下
      </button>
    </div>
  );
}
