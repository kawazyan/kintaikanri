"use client";

import type { MonthDay } from "@/lib/time";

export function DayChecklist({
  days,
  selected,
  lockedDates,
  onToggle,
  amounts,
  onAmountChange,
}: {
  days: MonthDay[];
  selected: Set<string>;
  lockedDates: Set<string>;
  onToggle: (dateKey: string) => void;
  // When provided, a per-day amount input is shown next to each selected,
  // unlocked day (used for SPOT per-shift pricing).
  amounts?: Record<string, number | null>;
  onAmountChange?: (dateKey: string, value: number | null) => void;
}) {
  return (
    <ul className="flex max-h-96 flex-col divide-y divide-slate-800 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/60">
      {days.map((d) => {
        const isLocked = lockedDates.has(d.dateKey);
        const isChecked = selected.has(d.dateKey) || isLocked;
        const showAmountInput = amounts && isChecked && !isLocked;
        return (
          <li key={d.dateKey} className="px-3 py-2">
            <label className="flex items-center justify-between text-sm">
              <span
                className={
                  d.weekday === 0
                    ? "text-red-400"
                    : d.weekday === 6
                      ? "text-blue-400"
                      : "text-slate-200"
                }
              >
                {d.day}日({d.weekdayLabel})
                {isLocked && <span className="ml-2 text-xs text-slate-500">登録済み</span>}
              </span>
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isLocked}
                onChange={() => onToggle(d.dateKey)}
                className="h-5 w-5 accent-blue-500"
              />
            </label>
            {showAmountInput && (
              <div className="mt-1 flex justify-end">
                <input
                  type="text"
                  inputMode="numeric"
                  value={amounts?.[d.dateKey]?.toLocaleString("ja-JP") ?? ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, "");
                    onAmountChange?.(d.dateKey, digits === "" ? null : Number(digits));
                  }}
                  placeholder="単価"
                  className="w-32 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1 text-right text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <span className="ml-1 self-center text-xs text-slate-500">円</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
