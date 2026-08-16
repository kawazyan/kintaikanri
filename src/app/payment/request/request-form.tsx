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
  "flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-medium text-white shadow-md shadow-blue-950/50 active:scale-[0.98] disabled:opacity-40";
const OUTLINE_BUTTON =
  "flex-1 rounded-xl border border-slate-700 py-3 text-sm text-slate-200 active:scale-[0.98] disabled:opacity-40";

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
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-slate-900 px-4 py-4 text-center text-white shadow-lg shadow-blue-950/60 ring-1 ring-blue-500/30">
        <p className="text-xs font-semibold tracking-wide text-blue-200 uppercase">振込申請可能額</p>
        <p className="text-2xl font-bold">{availableAmount.toLocaleString("ja-JP")}円</p>
      </div>

      {step === "input" && (
        <>
          <label className="flex flex-col gap-1 text-sm text-slate-400">
            申請金額
            <YenInput value={amount} onChange={setAmount} />
          </label>
          <button
            type="button"
            onClick={() => setAmount(availableAmount)}
            className="self-start text-sm text-blue-400 underline"
          >
            全額申請する({availableAmount.toLocaleString("ja-JP")}円)
          </button>

          <label className="flex flex-col gap-1 text-sm text-slate-400">
            希望振込日
            <input
              type="date"
              value={desiredDate}
              onChange={(e) => setDesiredDate(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="button"
            onClick={goConfirm}
            disabled={!amountValid}
            className={PRIMARY_BUTTON}
          >
            確認画面へ
          </button>
        </>
      )}

      {step === "confirm" && amount !== null && (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-100 backdrop-blur-sm">
            <dt className="text-slate-500">申請金額</dt>
            <dd>{amount.toLocaleString("ja-JP")}円</dd>
            <dt className="text-slate-500">希望振込日</dt>
            <dd>{desiredDate}</dd>
          </dl>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("input")}
              disabled={pending}
              className={OUTLINE_BUTTON}
            >
              修正する
            </button>
            <button type="button" onClick={submit} disabled={pending} className={PRIMARY_BUTTON}>
              {pending ? "申請中..." : "申請確定"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
