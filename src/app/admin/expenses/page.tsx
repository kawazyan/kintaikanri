import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../admin-nav";
import { reviewExpense } from "./actions";
import { formatJst } from "@/lib/time";

const categoryLabel = (c: string) => (c === "TRAVEL" ? "交通費" : c === "LODGING" ? "宿泊費" : "その他経費");
const statusLabel = (s: string) =>
  s === "DRAFT" ? "下書き" : s === "SUBMITTED" ? "申請中" : s === "APPROVED" ? "承認済み" : s === "REJECTED" ? "却下" : s;

export default async function AdminExpenses() {
  await requireAdmin();
  const items = await prisma.expense.findMany({
    include: {
      staff: true,
      workOrderStaff: { include: { workOrder: { include: { client: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-slate-100">
      <AdminNav />
      <h1 className="text-2xl font-black">経費確認</h1>
      <div className="mt-6 space-y-3">
        {items.map((x) => (
          <article key={x.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-black">{x.staff.name} ・ {categoryLabel(x.category)}</p>
                <p className="text-sm text-slate-400">
                  {formatJst(x.expenseDate).slice(0, 10)} ・ {x.workOrderStaff?.workOrder.client.name || "案件指定なし"} ・ {x.description || "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-black">税込 ¥{x.amountTaxInclusive.toLocaleString()}</p>
                <p className="text-xs text-slate-400">税抜 ¥{x.amountExTax.toLocaleString()} / 税 ¥{x.taxAmount.toLocaleString()} ・ {statusLabel(x.status)}</p>
              </div>
            </div>
            {x.status === "SUBMITTED" && (
              <form className="mt-4 grid gap-2 md:grid-cols-[1fr_160px_1fr_auto_auto]">
                <input name="reviewerName" required placeholder="確認者名" className="rounded-lg bg-slate-800 px-3 py-2 text-sm" />
                <input name="amountTaxInclusive" type="number" defaultValue={x.amountTaxInclusive} className="rounded-lg bg-slate-800 px-3 py-2 text-sm" />
                <input name="reviewNote" placeholder="確認メモ" className="rounded-lg bg-slate-800 px-3 py-2 text-sm" />
                <button formAction={reviewExpense.bind(null, x.id, "APPROVED")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black">承認</button>
                <button formAction={reviewExpense.bind(null, x.id, "REJECTED")} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-black">却下</button>
              </form>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
