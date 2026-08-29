import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { ClientAutoRefresh } from "../../client/components/auto-refresh";

export default async function WorkOrderSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await prisma.workOrderAccessToken.findUnique({
    where: { token },
    include: {
      workOrder: {
        include: {
          client: true,
          staffAssignments: {
            include: {
              staff: true,
              shifts: { include: { clockRecords: true }, orderBy: { startTime: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!access?.active) notFound();
  const o = access.workOrder;

  return (
    <>
      <ClientAutoRefresh intervalMs={8000} />
      <main className="min-h-dvh bg-[#f4f5f7] text-slate-900">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-black text-slate-400">勤務共有 / {o.yearMonth}</p><h1 className="text-2xl font-black">{o.client.name}</h1><p className="mt-1 text-sm text-slate-500">{o.defaultStoreName}</p></div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black shadow-sm ring-1 ring-black/5">8秒ごとに自動更新</span>
          </div>
          <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
            {o.staffAssignments.map((a) => (
              <div key={a.id} className="border-b p-5 last:border-0">
                <div className="flex items-center justify-between"><h2 className="text-lg font-black">{a.staff?.name ?? a.requestedName}</h2>{!a.active && <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">稼働キャンセル</span>}</div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead><tr className="text-left text-xs text-slate-400"><th className="pb-2">日付</th><th>稼働先</th><th>予定時間</th><th>出勤</th><th>退勤</th><th>状況</th></tr></thead>
                    <tbody>
                      {a.shifts.map((s) => {
                        const inn = s.clockRecords.find((r) => r.type === "IN");
                        const out = [...s.clockRecords].reverse().find((r) => r.type === "OUT");
                        const status = s.cancelledAt ? "キャンセル" : inn && out ? "勤務完了" : inn ? "勤務中" : "未出勤";
                        return <tr key={s.id} className="border-t"><td className="py-3">{formatJst(s.startTime).slice(0,10)}</td><td>{s.storeName}</td><td>{formatJst(s.startTime).slice(-5)}–{formatJst(s.endTime).slice(-5)}</td><td>{inn?formatJst(inn.timestamp).slice(-5):"--:--"}</td><td>{out?formatJst(out.timestamp).slice(-5):"--:--"}</td><td><span className={`rounded-full px-2 py-1 text-xs font-bold ${status==="勤務中"?"bg-emerald-50 text-emerald-700":status==="キャンセル"?"bg-red-50 text-red-600":"bg-slate-100 text-slate-600"}`}>{status}</span></td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
          <p className="mt-4 text-xs text-slate-400">このURLはこの稼働依頼・対象月だけを表示します。K.J側で共有停止されるまで有効です。</p>
        </div>
      </main>
    </>
  );
}
