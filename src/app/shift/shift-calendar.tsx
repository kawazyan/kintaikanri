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
      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 px-2 py-2.5 shadow-md shadow-black/30">
        <Link
          href={`/shift?month=${prevMonth}`}
          className="rounded-lg p-2 text-slate-400 transition active:scale-95 active:bg-slate-800"
        >
          <ChevronLeft size={18} />
        </Link>
        <span className="text-sm font-semibold text-slate-100">{monthLabel}</span>
        <Link
          href={`/shift?month=${nextMonth}`}
          className="rounded-lg p-2 text-slate-400 transition active:scale-95 active:bg-slate-800"
        >
          <ChevronRight size={18} />
        </Link>
      </div>

      <div>
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] text-slate-500">
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
                    ? "bg-gradient-to-br from-blue-600 to-cyan-500 font-bold text-white shadow-md shadow-blue-950/50"
                    : isToday
                      ? "border border-cyan-500/60 text-cyan-300"
                      : day.isWeekend
                        ? "text-red-400/70"
                        : "text-slate-300"
                }`}
              >
                {day.day}
                {hasShift && (
                  <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-cyan-400"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-blue-400/80 uppercase">
          {selectedDay ? `${selectedDay}日のシフト` : "日付を選択してください"}
        </h2>

        {selected && selectedShifts.length === 0 && (
          <p className="text-sm text-slate-500">この日のシフトはありません。</p>
        )}

        {selectedShifts.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm shadow-md shadow-black/30 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-300">
                {WORK_TYPE_LABEL[s.workType]}
              </span>
              <div className="flex items-center gap-3">
                <Link href={`/shift/${s.id}`} className="flex items-center gap-1 text-blue-400">
                  <Pencil size={13} />
                  編集
                </Link>
                <Link href={`/shift/new?copy=${s.id}`} className="flex items-center gap-1 text-blue-400">
                  <Copy size={13} />
                  複製
                </Link>
                <DeleteShiftButton shiftId={s.id} />
              </div>
            </div>
            <div className="mt-1 font-medium text-slate-100">
              {s.startTime} 〜 {s.endTime}
            </div>
            <div className="text-slate-400">
              {s.carrier} / {s.storeName}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
