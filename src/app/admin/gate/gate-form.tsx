"use client";

import { useActionState } from "react";
import { submitAdminPassword } from "./actions";

export function AdminGateForm() {
  const [state, formAction, pending] = useActionState(submitAdminPassword, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        type="password"
        name="password"
        required
        autoFocus
        placeholder="管理者パスワード"
        className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
      />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-base font-medium text-white shadow-lg shadow-blue-950/50 active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "確認中..." : "管理画面に入る"}
      </button>
    </form>
  );
}
