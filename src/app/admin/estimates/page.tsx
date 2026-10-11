import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { AdminNav } from "../admin-nav";

export default async function EstimatesPage() {
  await requireAdmin();
  const estimates = await prisma.estimate.findMany({ include: { client: true }, orderBy: { createdAt: "desc" }, take: 300 });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-100">
      <AdminNav />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">見積書</h1>
          <p className="mt-1 text-sm text-slate-400">作成して「保存だけ」にするか、そのまま取引先へ送付するかを選べます。</p>
        </div>
        <Link href="/admin/estimates/new" className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white">
          見積書を作成
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {estimates.length === 0 && <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">見積書はまだありません。</p>}
        {estimates.map((e) => (
          <Link key={e.id} href={`/admin/estimates/${e.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div>
              <p className="font-black">
                {e.client.name} ・ {e.subject}
              </p>
              <p className="text-xs text-slate-400">
                {e.estimateNumber} ・ 発行日 {e.issuedDate} ・ {e.status === "SENT" ? `送付済み ${e.sentAt ? formatJst(e.sentAt) : ""}` : "保存済み（未送付）"}
              </p>
            </div>
            <p className="text-lg font-black">¥{e.totalInclTax.toLocaleString()}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
