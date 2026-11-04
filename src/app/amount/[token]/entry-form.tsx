"use client";

import { useState, useTransition } from "react";
import { submitAmountEntry, type AmountEntryResult } from "./actions";

const labelClass = "text-sm font-bold text-slate-800";
const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 placeholder:text-slate-400 disabled:bg-slate-100";

export function AmountEntryForm({ token, months, defaultMonth }: { token: string; months: string[]; defaultMonth: string }) {
  const [yearMonth, setYearMonth] = useState(defaultMonth);
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<AmountEntryResult | null>(null);
  const [pending, startTransition] = useTransition();

  const done = result?.ok === true;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || done) return;
    const value = Number(amount.replace(/[,，\s]/g, ""));
    startTransition(async () => {
      const r = await submitAmountEntry(token, yearMonth, Number.isFinite(value) ? value : NaN);
      setResult(r);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className={labelClass}>対象月</span>
        <select value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} disabled={pending || done} className={inputClass}>
          {months.map((m) => (
            <option key={m} value={m}>{m.replace("-", "年")}月</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>金額（税抜・円）</span>
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="例: 650000"
          disabled={pending || done}
          className={inputClass}
          required
        />
      </label>
      <button
        type="submit"
        disabled={pending || done || !amount.trim()}
        className="w-full rounded-xl px-4 py-3 text-base font-black text-white disabled:opacity-40"
        style={{ background: "linear-gradient(145deg,#325783,#0b1c36)" }}
      >
        {pending ? "送信中…" : "送信する"}
      </button>
      {result && (
        <p className={`rounded-xl p-3 text-sm font-bold ${result.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
          {result.ok ? result.message : result.error}
        </p>
      )}
    </form>
  );
}
