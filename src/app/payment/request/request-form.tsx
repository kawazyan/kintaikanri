"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { YenInput } from "@/components/yen-input";
import { createTransferRequest } from "../actions";

function todayDateValue(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

const PRIMARY_BUTTON =
  "relative flex-1 overflow-hidden rounded-xl bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-40";
const OUTLINE_BUTTON =
  "flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm text-slate-700 active:scale-[0.98] disabled:opacity-40";
const PRIMARY_BUTTON_SHADOW = {
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px rgba(220,38,38,0.4), 0 2px 4px rgba(0,0,0,0.3)",
};

export function RequestForm({ availableAmount }: { availableAmount: number }) {
  const router = useRouter();
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [amount, setAmount] = useState<number | null>(null);
  const [desiredDate, setDesiredDate] = useState(todayDateValue());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const amountValid = amount !== null && amount > 0 && amount <= availableAmount;

  function goConfirm() {
    if (!amountValid || !desiredDate) {
      setError("入力内容を確認してください");
      return;
    }
    setError(null);
    setStep("confirm");
  }

  function submit() {
    if (amount === null) return;
    startTransition(async () => {
      const result = await createTransferRequest({ amount, desiredDate });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push("/payment/history");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-700 px-4 py-4 text-center text-white shadow-[0_6px_20px_rgba(234,88,12,0.4)] ring-1 ring-amber-300/40">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
        <p className="relative text-xs font-bold tracking-wide text-amber-50 uppercase">
          振込申請可能額
        </p>
        <p className="relative text-2xl font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
          {availableAmount.toLocaleString("ja-JP")}円
        </p>
      </div>

      {step === "input" && (
        <>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            申請金額
            <YenInput value={amount} onChange={setAmount} />
          </label>
          <button
            type="button"
            onClick={() => setAmount(availableAmount)}
            className="self-start text-sm text-red-600 underline"
          >
            全額申請する({availableAmount.toLocaleString("ja-JP")}円)
          </button>

          <label className="flex flex-col gap-1 text-sm text-slate-600">
            希望振込日
            <input
              type="date"
              value={desiredDate}
              onChange={(e) => setDesiredDate(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-red-500 focus:outline-none"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={goConfirm}
            disabled={!amountValid}
            style={PRIMARY_BUTTON_SHADOW}
            className={PRIMARY_BUTTON}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
            <span className="relative">確認画面へ</span>
          </button>
        </>
      )}

      {step === "confirm" && amount !== null && (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-gradient-to-b from-white to-slate-100 p-4 text-sm text-slate-900 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
            <dt className="text-slate-500">申請金額</dt>
            <dd>{amount.toLocaleString("ja-JP")}円</dd>
            <dt className="text-slate-500">希望振込日</dt>
            <dd>{desiredDate}</dd>
          </dl>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("input")}
              disabled={pending}
              className={OUTLINE_BUTTON}
            >
              修正する
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              style={PRIMARY_BUTTON_SHADOW}
              className={PRIMARY_BUTTON}
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
              <span className="relative">{pending ? "申請中..." : "申請確定"}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
