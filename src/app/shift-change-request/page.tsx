import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst, formatJstDate } from "@/lib/time";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { SHIFT_CHANGE_KIND_LABEL, SHIFT_CHANGE_STATUS_LABEL } from "@/lib/attendance-requests";

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-500",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default async function ShiftChangeRequestPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  const requests = await prisma.shiftChangeRequest.findMany({
    where: { staffId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="min-h-dvh bg-[#f5f6f8] text-slate-900">
      <div className="mx-auto max-w-md px-4 pb-28 pt-6">
        <h1 className="text-2xl font-black">シフト変更申請</h1>
        <p className="mt-1 text-sm text-slate-500">関係者との調整が完了した内容をシステムへ申請します</p>

        <Link
          href="/shift-change-request/new"
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#b91c1c] py-3 text-sm font-black text-white shadow-[0_4px_0_#7f1d1d]"
        >
          <CalendarClock size={16} />
          シフト変更を申請する
        </Link>

        <section className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
          {requests.length ? (
            requests.map((r) => (
              <div key={r.id} className="border-b p-4 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black">
                      {SHIFT_CHANGE_KIND_LABEL[r.kind]}{" "}
                      <span className="ml-1 text-xs font-bold text-slate-400">{formatJstDate(r.targetDate)}</span>
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">{r.reason}</p>
                    {r.status === "REJECTED" && r.rejectionReason && (
                      <p className="mt-1 text-xs font-bold text-red-600">却下理由: {r.rejectionReason}</p>
                    )}
                    <p className="mt-1 text-[11px] text-slate-400">送信: {formatJst(r.createdAt)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${STATUS_TONE[r.status]}`}>
                    {SHIFT_CHANGE_STATUS_LABEL[r.status]}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="p-5 text-sm text-slate-400">まだ申請はありません。</p>
          )}
        </section>
      </div>
      <BottomTabBar />
    </main>
  );
}
