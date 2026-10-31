"use client";

import { useActionState, useRef, useEffect } from "react";
import { SubmitButton } from "@/components/submit-button";
import { COMPANY_EXPENSE_CATEGORIES } from "@/lib/company-expense";
import { addCompanyExpense, type ExpenseFormState } from "./actions";

const INPUT = "w-full rounded-lg border border-[#94a3b8] bg-white px-3 py-2 text-sm text-[#1e293b] placeholder:!text-[#64748b]";
const LABEL = "flex flex-col gap-1 text-xs font-bold text-[#475569]";

export function AddExpenseForm({ defaultDate }: { defaultDate: string }) {
  const [state, action] = useActionState<ExpenseFormState, FormData>(addCompanyExpense, {});
  const formRef = useRef<HTMLFormElement>(null);

  // 追加できたら、項目・金額・メモを空に戻す(日付と区分は続けて入れやすいよう残す)。
  useEffect(() => {
    if (!state.savedAt || !formRef.current) return;
    for (const name of ["item", "amount", "memo"]) {
      const el = formRef.current.elements.namedItem(name);
      if (el instanceof HTMLInputElement) el.value = "";
    }
  }, [state.savedAt]);

  return (
    <form ref={formRef} action={action} className="rounded-2xl border-2 border-[#cbd5e1] bg-white p-5 shadow-sm">
      <h2 className="text-base font-extrabold text-[#1e293b]">経費を追加</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <label className={LABEL}>
          日付
          <input name="expenseDate" type="date" required defaultValue={defaultDate} className={INPUT} />
        </label>
        <label className={LABEL}>
          区分
          <select name="category" className={INPUT}>
            {COMPANY_EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={`${LABEL} md:col-span-2`}>
          項目(支払先など)
          <input name="item" required maxLength={100} placeholder="例: ニホンセーフティー(事務所家賃)" className={INPUT} />
        </label>
        <label className={LABEL}>
          金額(円)
          <input name="amount" inputMode="numeric" required placeholder="例: 109418" className={INPUT} />
        </label>
        <label className={`${LABEL} md:col-span-2`}>
          メモ(任意)
          <input name="memo" maxLength={300} className={INPUT} />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm font-bold text-[#1e293b]">
          <input type="checkbox" name="recurring" className="h-4 w-4" />
          毎月かかる固定費
        </label>
      </div>
      {state.error && <p className="mt-3 rounded-lg border border-[#f87171] bg-[#fef2f2] p-2 text-sm font-bold text-[#b91c1c]">{state.error}</p>}
      {state.savedAt && !state.error && <p className="mt-3 rounded-lg border border-[#34d399] bg-[#ecfdf5] p-2 text-sm font-bold text-[#047857]">追加しました。</p>}
      <SubmitButton className="mt-4 rounded-lg bg-[#1d4ed8] px-6 py-2 text-sm font-extrabold text-white" pendingText="保存中…">
        追加する
      </SubmitButton>
    </form>
  );
}
