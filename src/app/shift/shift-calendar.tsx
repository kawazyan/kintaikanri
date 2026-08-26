"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Copy, Clock, Building2 } from "lucide-react";
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
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-b from-white to-slate-100 px-2 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
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

      <div className="rounded-2xl bg-gradient-to-b from-white to-slate-100 p-3 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
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
                className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border text-sm transition active:scale-95 ${
                  isSelected
                    ? "border-transparent bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 font-bold text-white shadow-[0_2px_8px_rgba(220,38,38,0.5)]"
                    : isToday
                      ? "border-red-400 bg-red-50/60 font-semibold text-red-600"
                      : day.isWeekend
                        ? "border-slate-200 bg-white text-red-500/70 active:bg-red-50"
                        : "border-slate-200 bg-white text-slate-600 active:bg-slate-100"
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
            className="rounded-xl bg-gradient-to-b from-white to-slate-100 p-3 text-sm shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
          >
            <div className="flex items-center justify-between">
              <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600">
                {WORK_TYPE_LABEL[s.workType]}
              </span>
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/shift/${s.id}`}
                  className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition active:scale-95"
                >
                  <Pencil size={12} />
                  編集
                </Link>
                <Link
                  href={`/shift/new?copy=${s.id}`}
                  className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition active:scale-95"
                >
                  <Copy size={12} />
                  複製
                </Link>
                <DeleteShiftButton shiftId={s.id} />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 font-medium text-slate-900">
              <Clock size={14} className="text-slate-400" />
              {s.startTime} 〜 {s.endTime}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-slate-500">
              <Building2 size={14} className="text-slate-400" />
              {s.carrier} / {s.storeName}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
