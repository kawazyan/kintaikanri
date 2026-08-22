import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pt-8 pb-28">
      <div className="flex items-center justify-between">
        <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
          シフト一覧
        </h1>
        <Link
          href="/shift/new"
          className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-2 text-sm font-medium text-white shadow-md shadow-blue-950/50 active:scale-[0.98]"
        >
          <Plus size={16} />
          新規登録
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

      <BottomTabBar />
    </main>
  );
}
