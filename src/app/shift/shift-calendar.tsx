"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Copy,
  Clock,
  Building2,
  BriefcaseBusiness,
} from "lucide-react";
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

export function ShiftCalendar({ days, shiftsByDate, completedDates, todayDateKey, prevMonth, nextMonth, monthLabel }: {
  days: MonthDay[];
  shiftsByDate: Record<string, ShiftSummary[]>;
  completedDates: Record<string, boolean>;
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
    <div className="app-shift-wrap">
      <div className="app-month-switcher">
        <Link href={`/shift?month=${prevMonth}`} aria-label="前月"><ChevronLeft size={20} /></Link>
        <span>{monthLabel}</span>
        <Link href={`/shift?month=${nextMonth}`} aria-label="翌月"><ChevronRight size={20} /></Link>
      </div>

      <section className="app-calendar-card">
        <div className="app-calendar-weekdays">
          {WEEKDAY_LABELS.map((w, index) => (
            <div key={w} className={index === 0 ? "is-sun" : index === 6 ? "is-sat" : ""}>{w}</div>
          ))}
        </div>
        <div className="app-calendar-grid">
          {leadingBlanks.map((_, i) => <div key={`blank-${i}`} />)}
          {days.map((day) => {
            const hasShift = (shiftsByDate[day.dateKey]?.length ?? 0) > 0;
            const isCompleted = !!completedDates[day.dateKey];
            const isSelected = day.dateKey === selected;
            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => setSelected(day.dateKey)}
                className={`app-calendar-day ${isSelected ? "is-selected" : ""} ${hasShift ? "has-shift" : ""}`}
              >
                <span>{day.day}</span>
                {hasShift && <i aria-hidden="true" />}
                {isCompleted && <em className="app-calendar-day__stamp">済</em>}
              </button>
            );
          })}
        </div>
        <div className="app-calendar-legend">
          <span><i className="dot shift" />シフトあり</span>
          <span><i className="dot selected" />選択中</span>
        </div>
      </section>

      <section className="app-selected-shift">
        <div className="app-section-title-row">
          <div>
            <p className="app-section-kicker">SELECTED DATE</p>
            <h2>{selectedMeta ? `${selectedMeta.day}日（${selectedMeta.weekdayLabel}）` : "選択日のシフト"}</h2>
          </div>
        </div>

        {selected && selectedShifts.length === 0 && (
          <div className="app-empty-card">
            <CalendarX2 size={24} />
            <div>
              <p>この日のシフトはありません</p>
              <span>別の日をタップして予定を確認できます</span>
            </div>
          </div>
        )}

        {selectedShifts.map((s) => (
          <article key={s.id} className="app-shift-card">
            <div className="app-shift-card__head">
              <span className={`app-pill ${s.workType === "SPOT" ? "app-pill--green" : "app-pill--blue"}`}>
                <BriefcaseBusiness size={12} />{WORK_TYPE_LABEL[s.workType]}
              </span>
              <div className="app-shift-card__actions">
                <Link href={`/shift/${s.id}`}><Pencil size={13}/>編集</Link>
                <Link href={`/shift/new?copy=${s.id}`}><Copy size={13}/>複製</Link>
                <DeleteShiftButton shiftId={s.id} />
              </div>
            </div>
            <div className="app-shift-card__body">
              <div className="app-shift-info">
                <span className="app-shift-info__icon"><Clock size={18}/></span>
                <div><small>勤務時間</small><strong>{s.startTime} - {s.endTime}</strong></div>
              </div>
              <div className="app-shift-info">
                <span className="app-shift-info__icon"><Building2 size={18}/></span>
                <div className="min-w-0"><small>勤務先</small><strong className="truncate">{s.storeName}</strong><em>{s.carrier}</em></div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
