"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarX2, ChevronLeft, ChevronRight, Pencil, Copy, Clock, Building2, BriefcaseBusiness } from "lucide-react";
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

export function ShiftCalendar({ days, shiftsByDate, todayDateKey, prevMonth, nextMonth, monthLabel }: {
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
  const [selected, setSelected] = useState<string | null>(isCurrentMonth ? todayDateKey : days[0]?.dateKey ?? null);
  const selectedShifts = selected ? (shiftsByDate[selected] ?? []) : [];
  const selectedMeta = days.find((d) => d.dateKey === selected);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-[18px] bg-white px-2 py-2 shadow-[0_4px_16px_rgba(15,23,42,.07)] ring-1 ring-black/5">
        <Link href={`/shift?month=${prevMonth}`} className="rounded-xl p-2.5 text-slate-500 transition active:scale-95 active:bg-slate-100"><ChevronLeft size={18} /></Link>
        <span className="text-sm font-black text-slate-950">{monthLabel}</span>
        <Link href={`/shift?month=${nextMonth}`} className="rounded-xl p-2.5 text-slate-500 transition active:scale-95 active:bg-slate-100"><ChevronRight size={18} /></Link>
      </div>

      <div className="rounded-[22px] bg-white p-3 shadow-[0_5px_18px_rgba(15,23,42,.08)] ring-1 ring-black/5">
        <div className="mb-1.5 grid grid-cols-7 text-center text-[10px] font-black text-slate-400">
          {WEEKDAY_LABELS.map((w) => <div key={w}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {leadingBlanks.map((_, i) => <div key={`blank-${i}`} />)}
          {days.map((day) => {
            const hasShift = (shiftsByDate[day.dateKey]?.length ?? 0) > 0;
            const isToday = day.dateKey === todayDateKey;
            const isSelected = day.dateKey === selected;
            return (
              <button key={day.dateKey} type="button" onClick={() => setSelected(day.dateKey)} className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm font-bold transition active:scale-95 ${isSelected ? "bg-red-600 text-white shadow-[0_3px_9px_rgba(220,38,38,.22)]" : isToday ? "bg-red-50 text-red-600 ring-1 ring-red-200" : "text-slate-600 active:bg-slate-50"}`}>
                {day.day}
                {hasShift ? <span className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-red-500"}`} /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[13px] font-black text-slate-900">{selectedMeta ? `${selectedMeta.day}日（${selectedMeta.weekdayLabel}）` : "選択日のシフト"}</h2>
          {selected === todayDateKey ? <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-black text-red-600">今日</span> : null}
        </div>

        {selected && selectedShifts.length === 0 ? (
          <div className="rounded-[22px] bg-white px-5 py-8 text-center shadow-[0_5px_18px_rgba(15,23,42,.07)] ring-1 ring-black/5">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50"><CalendarX2 size={23} className="text-slate-300" /></span>
            <p className="mt-3 text-sm font-black text-slate-700">この日のシフトはありません</p>
            <p className="mt-1 text-xs text-slate-400">予定を登録すると、ここに勤務先と時間が表示されます</p>
          </div>
        ) : null}

        {selectedShifts.map((s) => (
          <article key={s.id} className="overflow-hidden rounded-[22px] bg-white shadow-[0_5px_18px_rgba(15,23,42,.08)] ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black text-red-600"><BriefcaseBusiness size={11}/>{WORK_TYPE_LABEL[s.workType]}</span>
              <div className="flex items-center gap-1">
                <Link href={`/shift/${s.id}`} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 active:bg-slate-50"><Pencil size={12}/>編集</Link>
                <Link href={`/shift/new?copy=${s.id}`} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 active:bg-slate-50"><Copy size={12}/>複製</Link>
                <DeleteShiftButton shiftId={s.id} />
              </div>
            </div>
            <div className="grid gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50"><Clock size={17} className="text-red-600"/></span>
                <div><p className="text-[10px] font-bold text-slate-400">勤務時間</p><p className="text-[16px] font-black tabular-nums text-slate-900">{s.startTime} → {s.endTime}</p></div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50"><Building2 size={17} className="text-slate-500"/></span>
                <div className="min-w-0"><p className="text-[10px] font-bold text-slate-400">勤務先</p><p className="truncate text-sm font-black text-slate-900">{s.storeName}</p><p className="text-[11px] text-slate-400">{s.carrier}</p></div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
