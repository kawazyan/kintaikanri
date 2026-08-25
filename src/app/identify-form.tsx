"use client";

import { useActionState } from "react";
import { identifyStaff } from "./identify-actions";

export function IdentifyForm() {
  const [state, formAction, pending] = useActionState(identifyStaff, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        type="text"
        name="employeeCode"
        required
        autoFocus
        placeholder="社員コード"
        className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-red-500 focus:outline-none"
      />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 px-4 py-3 text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_12px_rgba(220,38,38,0.4)] active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "確認中..." : "次へ"}
      </button>
    </form>
  );
}
