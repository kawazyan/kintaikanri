import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../admin-nav";
import { Buttons } from "./buttons";

export default async function Page() {
  await requireAdmin();
  const rows = await prisma.giftExchange.findMany({
    include: { staff: { select: { name: true, employeeCode: true } } },
    orderBy: { requestedAt: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <AdminNav />
      <h1 className="text-2xl font-black">コイン交換申請</h1>
      <p className="mt-1 text-sm text-slate-500">デジタルギフトの申請確認・送付管理</p>
      <div className="mt-5 overflow-hidden rounded-2xl border bg-white">
        <div className="divide-y">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">申請はありません</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="grid gap-3 p-4 md:grid-cols-[1fr_1.5fr_.7fr_.7fr_1fr] md:items-center">
                <div>
                  <b>{r.staff.name}</b>
                  <p className="text-xs text-slate-400">{r.staff.employeeCode}</p>
                </div>
                <div>
                  <b>{r.brand}</b>
                  <p className="text-xs text-slate-400">{r.amountYen.toLocaleString()}円分</p>
                </div>
                <b>{r.coinsUsed.toLocaleString()} 🪙</b>
                <span className="text-xs font-black">
                  {r.status === "REQUESTED" ? "申請中" : r.status === "FULFILLED" ? "送付済み" : "却下"}
                </span>
                <div>{r.status === "REQUESTED" && <Buttons id={r.id} />}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
