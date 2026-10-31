"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { unlockCompanyExpenses, type ExpenseFormState } from "./actions";

export function UnlockForm() {
  const [state, action] = useActionState<ExpenseFormState, FormData>(unlockCompanyExpenses, {});
  return (
    <form action={action} className="mx-auto mt-10 max-w-sm rounded-2xl border-2 border-[#cbd5e1] bg-white p-6 shadow-sm">
      <h1 className="text-lg font-extrabold text-[#1e293b]">会社経費</h1>
      <p className="mt-1 text-sm text-[#475569]">このページはパスワードが必要です。</p>
      <input
        name="password"
        type="password"
        autoComplete="off"
        required
        placeholder="パスワード"
        className="mt-4 w-full rounded-lg border border-[#94a3b8] bg-white px-3 py-2 text-sm text-[#1e293b] placeholder:!text-[#64748b]"
      />
      {state.error && <p className="mt-3 rounded-lg border border-[#f87171] bg-[#fef2f2] p-2 text-sm font-bold text-[#b91c1c]">{state.error}</p>}
      <SubmitButton className="mt-4 w-full rounded-lg bg-[#1d4ed8] py-2 text-sm font-extrabold text-white" pendingText="確認中…">
        開く
      </SubmitButton>
    </form>
  );
}
