import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  DoorOpen,
  ReceiptText,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayShiftStatusSummary } from "@/lib/attendance";
import { jstDayRange } from "@/lib/time";
import { AdminNav } from "./admin-nav";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const { start: todayStart, end: todayEnd } = jstDayRange();
  const [staffCount, shiftCount, recordCount, clientCount, pendingRequests, pendingExpenses, todaySummary, todayIrregularCount] =
    await Promise.all([
      prisma.staff.count({ where: { status: "ACTIVE" } }),
      prisma.shift.count(),
      prisma.clockRecord.count(),
      prisma.client.count(),
      prisma.workOrder.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.expense.count({ where: { status: "SUBMITTED" } }),
      getTodayShiftStatusSummary(),
      prisma.irregularReport.count({ where: { targetDate: { gte: todayStart, lt: todayEnd } } }),
    ]);

  const todayTiles = [
    { label: "本日稼働予定", value: todaySummary.scheduledCount, unit: "名", icon: CalendarCheck2, filter: "scheduled" },
    { label: "出勤済み", value: todaySummary.clockedIn.length, unit: "名", icon: UserCheck, filter: "clocked_in" },
    { label: "未出勤", value: todaySummary.notClockedIn.length, unit: "名", icon: UserX, filter: "not_clocked_in" },
    { label: "退勤済み", value: todaySummary.clockedOut.length, unit: "名", icon: DoorOpen, filter: "clocked_out" },
    { label: "イレギュラー報告", value: todayIrregularCount, unit: "件", icon: AlertTriangle, filter: "irregular" },
  ];

  const stats = [
    { label: "在籍スタッフ", value: staffCount, icon: Users, href: "/admin/staff" },
    { label: "登録シフト", value: shiftCount, icon: CalendarDays, href: "/admin/shifts" },
    { label: "打刻記録", value: recordCount, icon: Clock3, href: "/admin/records" },
    { label: "取引先", value: clientCount, icon: Building2, href: "/admin/clients" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <AdminNav />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-red-600">ADMIN DASHBOARD</p>
          <h1 className="mt-1 text-[28px] font-black tracking-[-0.035em] text-slate-950">管理ダッシュボード</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">勤怠・取引先・請求まで、ここからまとめて管理できます。</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((item, index) => {
          const Icon = item.icon;
          const dark = index === 0;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`group rounded-[22px] p-5 shadow-[0_10px_24px_rgba(15,23,42,.08)] transition active:translate-y-0.5 ${
                dark ? "bg-gradient-to-br from-[#1e3448] to-[#102235] text-white" : "border border-slate-200 bg-white text-slate-950"
              }`}
            >
              <div className="flex items-start justify-between">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${dark ? "bg-white/10" : "bg-slate-100"}`}>
                  <Icon size={21} />
                </span>
                <ChevronRight size={18} className={dark ? "text-slate-400" : "text-slate-300"} />
              </div>
              <p className="mt-5 text-[30px] font-black tabular-nums">{item.value.toLocaleString("ja-JP")}</p>
              <p className={`mt-1 text-sm font-bold ${dark ? "text-slate-300" : "text-slate-500"}`}>{item.label}</p>
            </Link>
          );
        })}
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-2">
        <Link href="/admin/requests" className="flex items-center gap-4 rounded-[24px] bg-gradient-to-r from-[#14283b] to-[#20394f] p-5 text-white shadow-[0_10px_26px_rgba(15,23,42,.14)] active:translate-y-0.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><ClipboardCheck size={25} /></span>
          <div>
            <p className="text-xs font-bold text-slate-300">確認が必要な稼働依頼</p>
            <p className="mt-1 text-2xl font-black">{pendingRequests}件</p>
          </div>
          <ChevronRight className="ml-auto text-slate-300" />
        </Link>

        <Link href="/admin/expenses" className="flex items-center gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,.08)] active:translate-y-0.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><ReceiptText size={25} /></span>
          <div>
            <p className="text-xs font-bold text-slate-500">未確認の経費申請</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{pendingExpenses}件</p>
          </div>
          <ChevronRight className="ml-auto text-slate-300" />
        </Link>
      </section>

      <section className="mt-8">
        <p className="mb-3 text-xs font-black tracking-[0.18em] text-red-600">今日の稼働状況</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {todayTiles.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.filter}
                href={`/admin/today?filter=${item.filter}`}
                className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,.06)] transition active:translate-y-0.5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <Icon size={18} />
                </span>
                <p className="mt-3 text-2xl font-black tabular-nums text-slate-950">
                  {item.value}
                  <span className="ml-0.5 text-xs font-bold text-slate-400">{item.unit}</span>
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">{item.label}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
