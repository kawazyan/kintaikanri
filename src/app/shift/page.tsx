import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, CalendarDays } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  currentJstYearMonth,
  jstMonthRange,
  listDaysInJstYearMonth,
  toJstDateValue,
  toJstTimeValue,
  yearMonthLabel,
} from "@/lib/time";
import { ShiftCalendar, type ShiftSummary } from "./shift-calendar";
import { BottomTabBar } from "@/components/bottom-tab-bar";

function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function ShiftListPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  const { month } = await searchParams;
  const yearMonth = month ?? currentJstYearMonth();
  const { start, end } = jstMonthRange(yearMonth);

  const shifts = await prisma.shift.findMany({
    where: { staffId, startTime: { gte: start, lt: end } },
    orderBy: { startTime: "asc" },
  });

  const shiftsByDate: Record<string, ShiftSummary[]> = {};
  for (const s of shifts) {
    const key = toJstDateValue(s.startTime);
    const entry: ShiftSummary = {
      id: s.id,
      workType: s.workType,
      carrier: s.carrier,
      storeName: s.storeName,
      startTime: toJstTimeValue(s.startTime),
      endTime: toJstTimeValue(s.endTime),
    };
    (shiftsByDate[key] ??= []).push(entry);
  }

  return (
    <main className="min-h-dvh bg-gradient-to-b from-white via-[#fdfaf5] to-[#faf5eb]">
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pt-8 pb-28">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-xl font-bold text-transparent">
          <CalendarDays size={20} className="text-red-500" />
          シフト一覧
        </h1>
        <Link
          href="/shift/new"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px rgba(220,38,38,0.4), 0 2px 4px rgba(0,0,0,0.3)",
          }}
          className="relative flex items-center gap-1 overflow-hidden rounded-xl bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 px-3 py-2 text-sm font-semibold text-white active:scale-[0.98]"
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
          <Plus size={16} className="relative" />
          <span className="relative">新規登録</span>
        </Link>
      </div>

      <ShiftCalendar
        days={listDaysInJstYearMonth(yearMonth)}
        shiftsByDate={shiftsByDate}
        todayDateKey={toJstDateValue(new Date())}
        prevMonth={shiftYearMonth(yearMonth, -1)}
        nextMonth={shiftYearMonth(yearMonth, 1)}
        monthLabel={yearMonthLabel(yearMonth)}
      />
    </div>

      <BottomTabBar />
    </main>
  );
}
