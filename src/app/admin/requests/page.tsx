import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../admin-nav";
import { DeleteOrderButton } from "./delete-order-button";

export default async function AdminRequests() {
  await requireAdmin();
  const orders = await prisma.workOrder.findMany({
    include: { client: true, staffAssignments: { include: { staff: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-100">
      <AdminNav />
      <div className="flex justify-between"><h1 className="text-2xl font-black">稼働依頼</h1><span className="text-sm text-slate-400">{orders.length}件</span></div>
      <p className="mt-2 text-xs font-bold text-slate-500">誤送信など不要な案件は、各案件の「案件を削除」から完全削除できます。</p>
      <div className="mt-6 space-y-3">
        {orders.map((o) => (
          <article key={o.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link href={`/admin/requests/${o.id}`} className="min-w-0 flex-1 hover:opacity-90">
                <p className="text-xs text-slate-400">{o.client.name} ・ {o.yearMonth}</p>
                <h2 className="mt-1 font-black">{o.defaultStoreName}</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">{o.requestedCarrier || "キャリア未設定"} ・ {o.requestType === "CATCH" ? "キャッチ" : o.requestType === "CLOSER" ? "クローザー" : o.requestType === "CONSULTING" ? "コンサルティング" : "帯稼働"}</p>
                <p className="mt-1 text-sm text-slate-400">{o.staffAssignments.map((s) => s.staff?.name ?? s.requestedName).join(" / ")}</p>
              </Link>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="h-fit rounded-full bg-slate-800 px-3 py-1 text-xs font-black">{o.status}</span>
                <DeleteOrderButton id={o.id} compact />
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
