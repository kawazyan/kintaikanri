"use client";

import { useState, useTransition } from "react";
import { submitAmountEntry, type AmountEntryResult } from "./actions";

export function AmountEntryForm({ token, months }: { token: string; months: string[] }) {
  const [yearMonth, setYearMonth] = useState(months[2] ?? months[0]);
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<AmountEntryResult | null>(null);
  const [pending, startTransition] = useTransition();

  const done = result?.ok === true;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || done) return;
    const digits = amount.replace(/[,，\s]/g, "");
    const value = Number(digits);
    startTransition(async () => {
      const r = await submitAmountEntry(token, yearMonth, Number.isFinite(value) ? value : NaN);
      setResult(r);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-bold text-slate-700">対象月</span>
        <select
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          disabled={pending || done}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base"
        >
          {months.map((m) => (
            <option key={m} value={m}>{m.replace("-", "年")}月</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-bold text-slate-700">金額（税抜・円）</span>
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="例: 650000"
          disabled={pending || done}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base"
          required
        />
      </label>
      <button
        type="submit"
        disabled={pending || done || !amount.trim()}
        className="w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-black text-white disabled:opacity-40"
      >
        {pending ? "送信中…" : "送信する"}
      </button>
      {result && (
        <p className={`rounded-xl p-3 text-sm font-bold ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {result.ok ? result.message : result.error}
        </p>
      )}
    </form>
  );
}
