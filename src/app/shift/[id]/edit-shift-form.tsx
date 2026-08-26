"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CARRIERS, CARRIER_OTHER, WORK_TYPE_LABEL, isPresetCarrier } from "@/lib/carriers";
import { TIME_OPTIONS } from "@/lib/time";
import { YenInput } from "@/components/yen-input";
import { updateShift } from "../actions";

type WorkType = "BAND" | "SPOT";

const SELECT_CLASS =
  "rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none";

export function EditShiftForm({
  shiftId,
  defaultValues,
}: {
  shiftId: string;
  defaultValues: {
    workType: WorkType;
    carrier: string;
    storeName: string;
    date: string;
    startTime: string;
    endTime: string;
    unitAmount: number | null;
  };
}) {
  const router = useRouter();
  const [workType, setWorkType] = useState<WorkType>(defaultValues.workType);
  const defaultIsPreset = isPresetCarrier(defaultValues.carrier);
  const [carrierSelection, setCarrierSelection] = useState(
    defaultIsPreset ? defaultValues.carrier : CARRIER_OTHER
  );
  const [carrierOtherText, setCarrierOtherText] = useState(
    defaultIsPreset ? "" : defaultValues.carrier
  );
  const [storeName, setStoreName] = useState(defaultValues.storeName);
  const [date, setDate] = useState(defaultValues.date);
  const [startTime, setStartTime] = useState(defaultValues.startTime);
  const [endTime, setEndTime] = useState(defaultValues.endTime);
  const [unitAmount, setUnitAmount] = useState<number | null>(defaultValues.unitAmount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const carrier = carrierSelection === CARRIER_OTHER ? carrierOtherText.trim() : carrierSelection;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateShift(shiftId, {
        workType,
        carrier,
        storeName,
        date,
        startTime,
        endTime,
        unitAmount: workType === "SPOT" ? unitAmount : null,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push("/shift");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl bg-gradient-to-b from-white to-slate-100 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
    >
      <label className="flex flex-col gap-1 text-sm text-slate-600">
        稼働区分
        <select
          value={workType}
          onChange={(e) => setWorkType(e.target.value as WorkType)}
          className={SELECT_CLASS}
        >
          {(["BAND", "SPOT"] as const).map((wt) => (
            <option key={wt} value={wt}>
              {WORK_TYPE_LABEL[wt]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        キャリア
        <select
          value={carrierSelection}
          onChange={(e) => setCarrierSelection(e.target.value)}
          className={SELECT_CLASS}
        >
          {CARRIERS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      {carrierSelection === CARRIER_OTHER && (
        <input
          type="text"
          value={carrierOtherText}
          onChange={(e) => setCarrierOtherText(e.target.value)}
          placeholder="キャリア名を入力"
          required
          className={SELECT_CLASS}
        />
      )}

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        店舗名
        <input
          type="text"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          required
          className={SELECT_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        稼働日
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className={SELECT_CLASS}
        />
      </label>

      <div className="flex items-center gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm text-slate-600">
          開始時間
          <select
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={SELECT_CLASS}
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <span className="mt-5 text-slate-400">〜</span>
        <label className="flex flex-1 flex-col gap-1 text-sm text-slate-600">
          終業時間
          <select
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={SELECT_CLASS}
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {workType === "SPOT" && (
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          単価
          <YenInput value={unitAmount} onChange={setUnitAmount} />
        </label>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || !carrier || (workType === "SPOT" && unitAmount === null)}
        className="rounded-xl bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 px-4 py-3 text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_12px_rgba(220,38,38,0.4)] active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "保存中..." : "保存"}
      </button>
    </form>
  );
}
