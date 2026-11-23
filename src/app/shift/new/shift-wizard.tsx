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
import { CARRIERS, CARRIER_OTHER, WORK_TYPE_LABEL, carrierStorePrefix, isPresetCarrier } from "@/lib/carriers";
import {
  createShiftsBulk,
  getMonthPlanningData,
  adminCreateShiftsBulk,
  adminGetMonthPlanningData,
} from "../actions";
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

const STEP_LABELS = ["対象月", "区分", "店舗", "時間", "稼働日", "確認"];

const INPUT_CLASS =
  "rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none";
const SELECT_CLASS =
  "rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-red-500 focus:outline-none";
const PRIMARY_BUTTON =
  "flex-1 rounded-xl bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_12px_rgba(220,38,38,0.4)] active:scale-[0.98] disabled:opacity-40";
const OUTLINE_BUTTON =
  "flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm text-slate-700 active:scale-[0.98] disabled:opacity-40";

export function ShiftWizard({
  initial,
  initialDate,
  staffId,
  contractStores,
}: {
  /** 取引先の契約で決まっている店舗名(月ごと)。ある月は店舗名の入力を省き、これを自動で使う。 */
  contractStores?: Record<string, { storeName: string; clientName: string }>;
  initial?: WizardInitialValues;
  /** カレンダーで選んだ日(YYYY-MM-DD)。月と日付をあらかじめ選択済みにする。 */
  initialDate?: string;
  /** 管理者がスタッフの代わりに登録する場合に指定する。未指定なら現在ログイン中の本人。 */
  staffId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // 選べる月の範囲内の日付だけ、あらかじめ選択済みにする(範囲外は無視)。
  const presetDate =
    initialDate && listMonthOptions(3, 6).some((o) => o.value === initialDate.slice(0, 7)) ? initialDate : undefined;
  const [yearMonth, setYearMonth] = useState(presetDate ? presetDate.slice(0, 7) : currentJstYearMonth());
  const [workType, setWorkType] = useState<WorkType | null>(initial?.workType ?? null);

  const initialCarrierIsPreset = initial?.carrier ? isPresetCarrier(initial.carrier) : false;
  const [carrierSelection, setCarrierSelection] = useState<string>(
    initial?.carrier ? (initialCarrierIsPreset ? initial.carrier : CARRIER_OTHER) : ""
  );
  const [carrierOtherText, setCarrierOtherText] = useState(
    initial?.carrier && !initialCarrierIsPreset ? initial.carrier : ""
  );

  const [storeNameInput, setStoreName] = useState((initial?.storeName ?? "").replace(/店$/, ""));
  const contractStore = contractStores?.[yearMonth] ?? null;
  // 家電量販店=入力した店名そのまま / ショップ=先頭に「キャリア名＋ショップ」を付ける。コピー元のシフトがある場合の店名は、すでに完成した名前なのでそのまま(家電量販店扱い。入力が「店」で終わっていればそのまま)。
  const [storeKind, setStoreKind] = useState<"" | "SHOP" | "RETAIL">(initial?.storeName ? "RETAIL" : "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "10:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "19:00");

  // ⚠️ 重要: 全ての時間入力は日本時間（JST）です
  // 例：選択した "10:00" は JST の 10:00 を意味し、UTC の 01:00 として保存されます
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(presetDate ? [presetDate] : []));
  const [lockedDates, setLockedDates] = useState<Set<string>>(new Set());
  const [spotAmounts, setSpotAmounts] = useState<Record<string, number | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [pending, startTransition] = useTransition();

  const monthOptions = useMemo(() => listMonthOptions(3, 6), []);
  const monthDays = useMemo(() => listDaysInJstYearMonth(yearMonth), [yearMonth]);
  const carrier = carrierSelection === CARRIER_OTHER ? carrierOtherText.trim() : carrierSelection;
  const typedBase = storeNameInput.trim();
  // 語尾の「店」は自動で付く(入力に「店」が入っていても重ねない)
  const typedName = typedBase ? (typedBase.endsWith("店") ? typedBase : `${typedBase}店`) : "";
  const shopPrefix = storeKind === "SHOP" ? carrierStorePrefix(carrier) : null;
  const storeName = contractStore
    ? contractStore.storeName // 契約で決まっている月は、入力ではなく契約の店舗名(ショップの先頭の言葉はサーバーで付く)
    : shopPrefix && !typedName.startsWith(shopPrefix)
      ? `${shopPrefix}${typedName}`
      : typedName;
  const storeStepReady = !!carrier && (contractStore ? true : !!storeKind && !!typedName);

  function applyMonthData(data: { existingDates: string[] }) {
    setLockedDates(new Set(data.existingDates));
    setSelectedDates((prev) => {
      const next = new Set(prev);
      for (const d of data.existingDates) next.delete(d);
      return next;
    });
    setLoadingMonth(false);
  }

  // User-triggered month switch (from the <select> onChange), not an effect.
  function loadMonthData(ym: string) {
    setLoadingMonth(true);
    startTransition(async () => {
      applyMonthData(
        staffId ? await adminGetMonthPlanningData(staffId, ym) : await getMonthPlanningData(ym)
      );
    });
  }

  // Initial fetch on mount for the default month. setState calls happen
  // only inside the .then() callback, not synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;
    const load = staffId
      ? adminGetMonthPlanningData(staffId, yearMonth)
      : getMonthPlanningData(yearMonth);
    load.then((data) => {
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

  // 単価は任意。入力されている場合のみ0以上の整数かを確認する。
  const spotAmountsValid =
    workType !== "SPOT" ||
    sortedSelectedDates.every((d) => {
      const amount = spotAmounts[d];
      return amount === null || amount === undefined || (Number.isInteger(amount) && amount >= 0);
    });

  function goNext() {
    setError(null);
    setStep((s) => Math.min(s + 1, 6));
  }
  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  function submit() {
    if (!workType || !carrier || !storeName.trim() || totalDayCount === 0 || !spotAmountsValid) {
      setError("入力内容を確認してください");
      return;
    }
    startTransition(async () => {
      const input = {
        yearMonth,
        workType,
        carrier,
        storeName,
        startTime,
        endTime,
        dates: sortedSelectedDates,
        spotAmounts:
          workType === "SPOT"
            ? Object.fromEntries(sortedSelectedDates.map((d) => [d, spotAmounts[d] ?? null]))
            : undefined,
      };
      const result = staffId
        ? await adminCreateShiftsBulk(staffId, input)
        : await createShiftsBulk(input);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(staffId ? "/admin/shifts" : "/shift");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-6 gap-1">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex min-w-0 flex-col items-center gap-1">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                i + 1 === step ? "bg-red-500 text-white" : i + 1 < step ? "bg-slate-500 text-white" : "bg-slate-200 text-slate-500"
              }`}
            >
              {i + 1}
            </span>
            <span className={`whitespace-nowrap text-xs ${i + 1 === step ? "font-semibold text-red-500" : "text-slate-500"}`}>{label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-gradient-to-b from-white to-slate-100 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
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
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-slate-900">キャリアと店舗を選択してください</h2>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-slate-600">キャリア</span>
            <div className="grid grid-cols-2 gap-2">
              {CARRIERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCarrierSelection(c)}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-xl border-2 px-1 py-2 text-sm font-bold leading-tight transition ${
                    carrierSelection === c
                      ? "border-red-500 bg-red-500/10 text-red-600 shadow-md shadow-red-900/10"
                      : "border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  {c.split("・").map((part, i) => (
                    <span key={part} className={i === 0 ? "" : "text-[11px] font-medium"}>
                      {part}
                    </span>
                  ))}
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
          </div>
          {!contractStore && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm text-slate-600">店の種類</span>
                <div className="grid grid-cols-2 gap-2">
                  {([["SHOP", "ショップ"], ["RETAIL", "家電量販店"]] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setStoreKind(v)}
                      className={`rounded-xl border-2 px-2 py-3 text-sm font-bold transition ${
                        storeKind === v
                          ? "border-red-500 bg-red-500/10 text-red-600 shadow-md shadow-red-900/10"
                          : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm text-slate-600">店名</span>
                <div className="flex items-center gap-2">
                  <input type="text" value={storeNameInput} onChange={(e) => setStoreName(e.target.value)} className={`${INPUT_CLASS} w-44 min-w-0 py-2`} />
                  <span className="text-base font-bold text-slate-700">店</span>
                </div>
              </div>
              {storeStepReady && (
                <div className="px-1">
                  <div className="text-xs text-slate-500">保存される店舗名</div>
                  <div className="text-base font-bold text-slate-900">{storeName}</div>
                </div>
              )}
            </>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={goBack} className={OUTLINE_BUTTON}>
              戻る
            </button>
            <button type="button" disabled={!storeStepReady} onClick={goNext} className={PRIMARY_BUTTON}>
              次へ
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">稼働予定時間を選択してください（日本時間）</h2>
          <div className="flex items-center gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm text-slate-600">
              開始時間（JST）
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
              終業時間（JST）
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
            ⚠️ 入力した時間は日本時間（JST）です。終業時間が開始時間より前の場合、翌日終業として登録されます。
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

      {step === 5 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">
            {yearMonthLabel(yearMonth)}の稼働日を選択してください({totalDayCount}日選択中)
          </h2>
          {workType === "SPOT" && (
            <p className="text-xs text-slate-500">稼働日ごとに単価を入力できます(未定の場合は空欄のままでも登録できます)。</p>
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

      {step === 6 && workType && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">登録内容の確認</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-900">
            <dt className="text-slate-500">対象月</dt>
            <dd>{yearMonthLabel(yearMonth)}</dd>
            <dt className="text-slate-500">稼働区分</dt>
            <dd>{WORK_TYPE_LABEL[workType]}</dd>
            <dt className="text-slate-500">キャリア</dt>
            <dd>{carrier}</dd>
            {!contractStore && (
              <>
                <dt className="text-slate-500">店舗名</dt>
                <dd>{storeName}</dd>
              </>
            )}
            <dt className="text-slate-500">時間（JST）</dt>
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
              </>
            ) : (
              <>
                <dt className="text-slate-500">稼働日・単価</dt>
                <dd>
                  <ul className="flex flex-col gap-0.5">
                    {sortedSelectedDates.map((d) => (
                      <li key={d}>
                        {d.slice(5).replace("-", "/")}:{" "}
                        {spotAmounts[d] != null ? `${spotAmounts[d]!.toLocaleString("ja-JP")}円` : "未定"}
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
