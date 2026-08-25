"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Copy } from "lucide-react";
import { WORK_TYPE_LABEL } from "@/lib/carriers";
import { DeleteShiftButton } from "./delete-shift-button";
import type { MonthDay } from "@/lib/time";

export type ShiftSummary = {
  id: string;
  workType: "BAND" | "SPOT";
  carrier: string;
  storeName: string;
  startTime: string;
  endTime: string;
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function ShiftCalendar({
  days,
  shiftsByDate,
  todayDateKey,
  prevMonth,
  nextMonth,
  monthLabel,
}: {
  days: MonthDay[];
  shiftsByDate: Record<string, ShiftSummary[]>;
  todayDateKey: string;
  prevMonth: string;
  nextMonth: string;
  monthLabel: string;
}) {
  const firstWeekday = days[0]?.weekday ?? 0;
  const leadingBlanks = Array.from({ length: firstWeekday });
  const isCurrentMonth = days.some((d) => d.dateKey === todayDateKey);

  const [selected, setSelected] = useState<string | null>(
    isCurrentMonth ? todayDateKey : null
  );
  const selectedShifts = selected ? (shiftsByDate[selected] ?? []) : [];
  const selectedDay = selected ? Number(selected.split("-")[2]) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-b from-white to-slate-100 px-2 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.3)]">
        <Link
          href={`/shift?month=${prevMonth}`}
          className="rounded-lg p-2 text-slate-500 transition active:scale-95 active:bg-slate-200"
        >
          <ChevronLeft size={18} />
        </Link>
        <span className="text-sm font-bold text-slate-900">{monthLabel}</span>
        <Link
          href={`/shift?month=${nextMonth}`}
          className="rounded-lg p-2 text-slate-500 transition active:scale-95 active:bg-slate-200"
        >
          <ChevronRight size={18} />
        </Link>
      </div>

      <div className="rounded-2xl bg-gradient-to-b from-white to-slate-100 p-3 shadow-[0_4px_14px_rgba(0,0,0,0.3)]">
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-slate-400">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {leadingBlanks.map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {days.map((day) => {
            const hasShift = (shiftsByDate[day.dateKey]?.length ?? 0) > 0;
            const isToday = day.dateKey === todayDateKey;
            const isSelected = day.dateKey === selected;
            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => setSelected(day.dateKey)}
                className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl text-sm transition active:scale-95 ${
                  isSelected
                    ? "bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 font-bold text-white shadow-[0_2px_8px_rgba(220,38,38,0.5)]"
                    : isToday
                      ? "border-[1.5px] border-red-500/70 font-semibold text-red-600"
                      : day.isWeekend
                        ? "text-red-500/70"
                        : "text-slate-600"
                }`}
              >
                {day.day}
                {hasShift && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-red-500"}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-bold tracking-wide text-red-500 uppercase">
          {selectedDay ? `${selectedDay}日のシフト` : "日付を選択してください"}
        </h2>

        {selected && selectedShifts.length === 0 && (
          <p className="text-sm text-slate-500">この日のシフトはありません。</p>
        )}

        {selectedShifts.map((s) => (
          <div
            key={s.id}
            className="rounded-xl bg-gradient-to-b from-white to-slate-100 p-3 text-sm shadow-[0_4px_14px_rgba(0,0,0,0.3)]"
          >
            <div className="flex items-center justify-between">
              <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600">
                {WORK_TYPE_LABEL[s.workType]}
              </span>
              <div className="flex items-center gap-3">
                <Link href={`/shift/${s.id}`} className="flex items-center gap-1 text-red-600">
                  <Pencil size={13} />
                  編集
                </Link>
                <Link href={`/shift/new?copy=${s.id}`} className="flex items-center gap-1 text-red-600">
                  <Copy size={13} />
                  複製
                </Link>
                <DeleteShiftButton shiftId={s.id} />
              </div>
            </div>
            <div className="mt-1 font-medium text-slate-900">
              {s.startTime} 〜 {s.endTime}
            </div>
            <div className="text-slate-500">
              {s.carrier} / {s.storeName}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
