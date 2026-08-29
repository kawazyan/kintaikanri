import { redirect } from "next/navigation";
import { Clock3, MapPin, Users, Radio, UserRoundCheck } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jstDayRange, toJstTimeValue } from "@/lib/time";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { PageHeader } from "@/components/page-header";

export default async function TownPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  const { start, end } = jstDayRange();
  const records = await prisma.clockRecord.findMany({
    where: { timestamp: { gte: start, lt: end }, staff: { status: "ACTIVE" } },
    include: { staff: true },
    orderBy: { timestamp: "asc" },
  });

  const byStaff = new Map<string, typeof records>();
  for (const record of records) {
    byStaff.set(record.staffId, [...(byStaff.get(record.staffId) ?? []), record]);
  }

  const attending = [...byStaff.values()]
    .filter((items) => items.at(-1)?.type === "IN")
    .map((items) => {
      const latest = items.at(-1)!;
      const firstIn = items.find((record) => record.type === "IN");
      return {
        id: latest.staff.id,
        name: latest.staff.name,
        storeName: latest.storeName,
        inTime: firstIn ? toJstTimeValue(firstIn.timestamp) : null,
        inTimestamp: firstIn?.timestamp.getTime() ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a.inTimestamp - b.inTimestamp || a.name.localeCompare(b.name, "ja"));

  return (
    <main className="staff-screen">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28">
        <PageHeader icon={Users} title="今日の出勤メンバー" eyebrow="TODAY" />

        <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700 p-5 text-white shadow-[0_12px_28px_rgba(5,150,105,.20)] ring-1 ring-white/20">
          <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/18 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-black tracking-[.12em] text-white/75">
                <Radio size={12} /> LIVE STATUS
              </p>
              <p className="mt-1 text-sm font-black">現在出勤中</p>
            </div>
            <p className="text-[34px] font-black leading-none tabular-nums">
              {attending.length}<span className="ml-1 text-sm text-white/75">名</span>
            </p>
          </div>
        </section>

        {attending.length > 0 ? (
          <section className="grid gap-3">
            {attending.map((member) => {
              const isMe = member.id === staffId;
              return (
                <article key={member.id} className="relative flex items-center gap-3 overflow-hidden rounded-[24px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,.07)] ring-1 ring-black/[.04]">
                  {isMe ? <span className="absolute inset-y-0 left-0 w-1 bg-emerald-500" /> : null}
                  <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-emerald-50 to-teal-50 text-[17px] font-black text-emerald-700 ring-1 ring-emerald-100">
                    {member.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-black text-slate-900">{member.name}</p>
                      {isMe ? <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-500">あなた</span> : null}
                    </div>
                    <div className="mt-1.5 flex flex-col gap-1 text-[11px] font-semibold text-slate-400">
                      {member.inTime ? <span className="flex items-center gap-1.5"><Clock3 size={11} className="text-emerald-500"/>{member.inTime} 出勤</span> : null}
                      {member.storeName ? <span className="flex min-w-0 items-center gap-1.5"><MapPin size={11} className="shrink-0 text-emerald-500"/><span className="truncate">{member.storeName}</span></span> : null}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 ring-1 ring-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 出勤中
                  </span>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="rounded-[26px] bg-white px-6 py-12 text-center shadow-[0_9px_26px_rgba(15,23,42,.07)] ring-1 ring-black/[.04]">
            <span className="mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-[22px] bg-emerald-50 ring-1 ring-emerald-100"><UserRoundCheck size={29} className="text-emerald-400" /></span>
            <h2 className="mt-4 text-sm font-black text-slate-800">現在出勤中のメンバーはいません</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">出勤打刻したメンバーがここに表示されます</p>
          </section>
        )}
      </div>
      <BottomTabBar />
    </main>
  );
}
