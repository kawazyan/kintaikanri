import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/page-header";
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
    <main className="min-h-dvh bg-gradient-to-b from-[#fbfbfc] via-[#f7f8fa] to-[#f1f3f6] text-slate-900">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28">
      <PageHeader
        icon={CalendarDays}
        title="シフト一覧"
        eyebrow={yearMonthLabel(yearMonth)}
        action={
          <Link
            href="/shift/new"
            className="flex items-center gap-1.5 rounded-[14px] bg-gradient-to-b from-red-500 to-red-700 px-3 py-2.5 text-xs font-black text-white shadow-[0_6px_14px_rgba(220,38,38,.22)] transition active:scale-[.97]"
          >
            <Plus size={15} /> 新規登録
          </Link>
        }
      />

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
