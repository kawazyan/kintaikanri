"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  currentJstYearMonth,
  listMonthOptions,
  listDaysInJstYearMonth,
  yearMonthLabel,
  TIME_OPTIONS,
} from "@/lib/time";
import { CARRIERS, CARRIER_OTHER, WORK_TYPE_LABEL, isPresetCarrier } from "@/lib/carriers";
import { YenInput } from "@/components/yen-input";
import { createShiftsBulk, getMonthPlanningData } from "../actions";
import { DayChecklist } from "./day-checklist";

type WorkType = "BAND" | "SPOT";

export type WizardInitialValues = {
  workType?: WorkType;
  carrier?: string;
  storeName?: string;
  startTime?: string;
  endTime?: string;
  unitAmount?: number | null;
};

const STEP_LABELS = ["対象月", "稼働区分", "キャリア", "店舗名", "稼働時間", "稼働日", "受取単価", "確認"];

const INPUT_CLASS =
  "rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none";
const SELECT_CLASS =
  "rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-red-500 focus:outline-none";
const PRIMARY_BUTTON =
  "flex-1 rounded-xl bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_12px_rgba(220,38,38,0.4)] active:scale-[0.98] disabled:opacity-40";
const OUTLINE_BUTTON =
  "flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm text-slate-700 active:scale-[0.98] disabled:opacity-40";

export function ShiftWizard({ initial }: { initial?: WizardInitialValues }) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [yearMonth, setYearMonth] = useState(currentJstYearMonth());
  const [workType, setWorkType] = useState<WorkType | null>(initial?.workType ?? null);

  const initialCarrierIsPreset = initial?.carrier ? isPresetCarrier(initial.carrier) : false;
  const [carrierSelection, setCarrierSelection] = useState<string>(
    initial?.carrier ? (initialCarrierIsPreset ? initial.carrier : CARRIER_OTHER) : ""
  );
  const [carrierOtherText, setCarrierOtherText] = useState(
    initial?.carrier && !initialCarrierIsPreset ? initial.carrier : ""
  );

  const [storeName, setStoreName] = useState(initial?.storeName ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "10:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "19:00");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [lockedDates, setLockedDates] = useState<Set<string>>(new Set());
  const [targetAmount, setTargetAmount] = useState<number | null>(null);
  const [spotAmounts, setSpotAmounts] = useState<Record<string, number | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [pending, startTransition] = useTransition();

  const monthOptions = useMemo(() => listMonthOptions(3, 6), []);
  const monthDays = useMemo(() => listDaysInJstYearMonth(yearMonth), [yearMonth]);
  const carrier = carrierSelection === CARRIER_OTHER ? carrierOtherText.trim() : carrierSelection;

  function applyMonthData(data: { existingDates: string[]; targetAmount: number | null }) {
    setLockedDates(new Set(data.existingDates));
    setSelectedDates((prev) => {
      const next = new Set(prev);
      for (const d of data.existingDates) next.delete(d);
      return next;
    });
    if (data.targetAmount !== null) setTargetAmount(data.targetAmount);
    setLoadingMonth(false);
  }

  // User-triggered month switch (from the <select> onChange), not an effect.
  function loadMonthData(ym: string) {
    setLoadingMonth(true);
    startTransition(async () => {
      applyMonthData(await getMonthPlanningData(ym));
    });
  }

  // Initial fetch on mount for the default month. setState calls happen
  // only inside the .then() callback, not synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;
    getMonthPlanningData(yearMonth).then((data) => {
      if (!cancelled) applyMonthData(data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedSelectedDates = useMemo(
    () => [...selectedDates].filter((d) => !lockedDates.has(d)).sort(),
    [selectedDates, lockedDates]
  );
  const totalDayCount = sortedSelectedDates.length + lockedDates.size;

  function toggleDate(key: string) {
    if (lockedDates.has(key)) return;
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setSpotAmounts((amounts) => {
          const rest = { ...amounts };
          delete rest[key];
          return rest;
        });
      } else {
        next.add(key);
        if (workType === "SPOT") {
          setSpotAmounts((amounts) => ({ ...amounts, [key]: initial?.unitAmount ?? null }));
        }
      }
      return next;
    });
  }

  const spotAmountsValid =
    workType !== "SPOT" ||
    sortedSelectedDates.every(
      (d) => Number.isInteger(spotAmounts[d]) && (spotAmounts[d] as number) >= 0
    );

  function goNext() {
    setError(null);
    setStep((s) => {
      if (s === 6 && workType === "SPOT") return 8; // BAND-only monthly amount step
      return Math.min(s + 1, 8);
    });
  }
  function goBack() {
    setError(null);
    setStep((s) => {
      if (s === 8 && workType === "SPOT") return 6;
      return Math.max(s - 1, 1);
    });
  }

  function submit() {
    if (!workType || !carrier || !storeName.trim() || totalDayCount === 0 || !spotAmountsValid) {
      setError("入力内容を確認してください");
      return;
    }
    startTransition(async () => {
      const result = await createShiftsBulk({
        yearMonth,
        workType,
        carrier,
        storeName,
        startTime,
        endTime,
        dates: sortedSelectedDates,
        targetAmount: workType === "BAND" ? targetAmount : null,
        spotAmounts:
          workType === "SPOT"
            ? Object.fromEntries(
                sortedSelectedDates.map((d) => [d, spotAmounts[d] as number])
              )
            : undefined,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push("/shift");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
        {STEP_LABELS.map((label, i) => (
          <span
            key={label}
            className={`flex-1 border-b-2 pb-1 text-center ${
              i + 1 === step ? "border-red-500 font-semibold text-red-500" : "border-slate-700"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="rounded-2xl bg-gradient-to-b from-white to-slate-100 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
      {step === 1 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">登録する月を選択してください</h2>
          <select
            value={yearMonth}
            onChange={(e) => {
              const ym = e.target.value;
              setYearMonth(ym);
              setSelectedDates(new Set());
              setSpotAmounts({});
              setTargetAmount(null);
              loadMonthData(ym);
            }}
            className={`${SELECT_CLASS} py-3 text-base`}
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={goNext}
            disabled={loadingMonth}
            className={PRIMARY_BUTTON}
          >
            {loadingMonth ? "読み込み中..." : "次へ"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">稼働区分を選択してください</h2>
          <div className="grid grid-cols-2 gap-3">
            {(["BAND", "SPOT"] as const).map((wt) => (
              <button
                key={wt}
                type="button"
                onClick={() => {
                  setWorkType(wt);
                  goNext();
                }}
                className={`rounded-xl border-2 py-6 text-base font-bold transition ${
                  workType === wt
                    ? "border-red-500 bg-red-500/10 text-red-600 shadow-md shadow-red-900/10"
                    : "border-slate-300 text-slate-600"
                }`}
              >
                {WORK_TYPE_LABEL[wt]}
              </button>
            ))}
          </div>
          <button type="button" onClick={goBack} className="mt-2 text-sm text-slate-500 underline">
            戻る
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">稼働キャリアを選択してください</h2>
          <div className="grid grid-cols-1 gap-2">
            {CARRIERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCarrierSelection(c)}
                className={`rounded-xl border-2 py-3 text-sm font-medium transition ${
                  carrierSelection === c
                    ? "border-red-500 bg-red-500/10 text-red-600 shadow-md shadow-red-900/10"
                    : "border-slate-300 text-slate-600"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {carrierSelection === CARRIER_OTHER && (
            <input
              type="text"
              value={carrierOtherText}
              onChange={(e) => setCarrierOtherText(e.target.value)}
              placeholder="キャリア名を入力"
              className={`${INPUT_CLASS} py-2 text-sm`}
            />
          )}
          <div className="flex gap-3">
            <button type="button" onClick={goBack} className={OUTLINE_BUTTON}>
              戻る
            </button>
            <button type="button" disabled={!carrier} onClick={goNext} className={PRIMARY_BUTTON}>
              次へ
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">稼働先店舗名を入力してください</h2>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="例: auショップ〇〇店"
            autoFocus
            className={INPUT_CLASS}
          />
          <div className="flex gap-3">
            <button type="button" onClick={goBack} className={OUTLINE_BUTTON}>
              戻る
            </button>
            <button
              type="button"
              disabled={!storeName.trim()}
              onClick={goNext}
              className={PRIMARY_BUTTON}
            >
              次へ
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">稼働予定時間を選択してください</h2>
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
            <span className="mt-5 text-slate-500">〜</span>
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
          <p className="text-xs text-slate-500">
            終業時間が開始時間より前の場合、翌日終業として登録されます。
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={goBack} className={OUTLINE_BUTTON}>
              戻る
            </button>
            <button type="button" onClick={goNext} className={PRIMARY_BUTTON}>
              次へ
            </button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">
            {yearMonthLabel(yearMonth)}の稼働日を選択してください({totalDayCount}日選択中)
          </h2>
          {workType === "SPOT" && (
            <p className="text-xs text-slate-500">稼働日ごとに単価を入力してください。</p>
          )}
          <DayChecklist
            days={monthDays}
            selected={selectedDates}
            lockedDates={lockedDates}
            onToggle={toggleDate}
            amounts={workType === "SPOT" ? spotAmounts : undefined}
            onAmountChange={
              workType === "SPOT"
                ? (key, value) => setSpotAmounts((prev) => ({ ...prev, [key]: value }))
                : undefined
            }
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={goBack} className={OUTLINE_BUTTON}>
              戻る
            </button>
            <button
              type="button"
              disabled={totalDayCount === 0 || !spotAmountsValid}
              onClick={goNext}
              className={PRIMARY_BUTTON}
            >
              次へ
            </button>
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">
            {yearMonthLabel(yearMonth)}合計の受取予定単価
          </h2>
          <p className="text-xs text-slate-500">
            未定の場合は空欄のままで構いません。あとから登録・更新できます。
          </p>
          <YenInput value={targetAmount} onChange={setTargetAmount} autoFocus />
          <div className="flex gap-3">
            <button type="button" onClick={goBack} className={OUTLINE_BUTTON}>
              戻る
            </button>
            <button type="button" onClick={goNext} className={PRIMARY_BUTTON}>
              次へ
            </button>
          </div>
        </div>
      )}

      {step === 8 && workType && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">登録内容の確認</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-900">
            <dt className="text-slate-500">対象月</dt>
            <dd>{yearMonthLabel(yearMonth)}</dd>
            <dt className="text-slate-500">稼働区分</dt>
            <dd>{WORK_TYPE_LABEL[workType]}</dd>
            <dt className="text-slate-500">キャリア</dt>
            <dd>{carrier}</dd>
            <dt className="text-slate-500">店舗名</dt>
            <dd>{storeName}</dd>
            <dt className="text-slate-500">時間</dt>
            <dd>
              {startTime} 〜 {endTime}
            </dd>
            {workType === "BAND" ? (
              <>
                <dt className="text-slate-500">稼働予定日</dt>
                <dd>
                  {[...sortedSelectedDates, ...lockedDates]
                    .sort()
                    .map((d) => d.slice(5).replace("-", "/"))
                    .join("・")}
                  {lockedDates.size > 0 && (
                    <span className="ml-1 text-xs text-slate-500">(登録済み分含む)</span>
                  )}
                </dd>
                <dt className="text-slate-500">稼働合計日数</dt>
                <dd>{totalDayCount}日</dd>
                <dt className="text-slate-500">月間受取予定単価</dt>
                <dd>{targetAmount !== null ? `${targetAmount.toLocaleString("ja-JP")}円` : "未定"}</dd>
              </>
            ) : (
              <>
                <dt className="text-slate-500">稼働日・単価</dt>
                <dd>
                  <ul className="flex flex-col gap-0.5">
                    {sortedSelectedDates.map((d) => (
                      <li key={d}>
                        {d.slice(5).replace("-", "/")}: {spotAmounts[d]?.toLocaleString("ja-JP")}円
                      </li>
                    ))}
                    {lockedDates.size > 0 && (
                      <li className="text-xs text-slate-500">
                        (登録済み: {[...lockedDates].sort().map((d) => d.slice(5).replace("-", "/")).join("・")})
                      </li>
                    )}
                  </ul>
                </dd>
                <dt className="text-slate-500">稼働合計日数</dt>
                <dd>{totalDayCount}日</dd>
              </>
            )}
          </dl>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={goBack} disabled={pending} className={OUTLINE_BUTTON}>
              修正する
            </button>
            <button type="button" onClick={submit} disabled={pending} className={PRIMARY_BUTTON}>
              {pending ? "登録中..." : "この内容で登録する"}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
