import { redirect } from "next/navigation";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentJstYearMonth, formatJst } from "@/lib/time";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { addExpense, deleteDraftExpense } from "./actions";
import { SubmitButton } from "@/components/submit-button";

const label = (c: string) => (c === "TRAVEL" ? "交通費" : c === "LODGING" ? "宿泊費" : "その他経費");

export default async function ExpensesPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");
  const ym = currentJstYearMonth();
  const [items, assignments, autoRules] = await Promise.all([
    prisma.expense.findMany({ where: { staffId, yearMonth: ym }, orderBy: { expenseDate: "desc" } }),
    prisma.workOrderStaff.findMany({
      where: { staffId, workOrder: { yearMonth: ym, status: { in: ["APPROVED", "CHANGES_PENDING"] } } },
      include: { workOrder: { include: { client: true } } },
    }),
    // 自動で経費が入る人(StaffExpenseRule)。入力不要の項目を画面に出して、二重に申請しないようにする
    prisma.staffExpenseRule.findMany({ where: { staffId, fromMonth: { lte: ym } }, orderBy: { createdAt: "asc" } }),
  ]);
  const autoKm = autoRules.some((r) => r.kind === "KM");
  const autoFixed = autoRules.filter((r) => r.kind === "FIXED" && r.label && r.amount != null);
  const total = items.reduce((s, x) => s + x.amountTaxInclusive, 0);

  return (
    <main className="request-screen min-h-dvh text-slate-100">
      <div className="mx-auto max-w-md px-4 pb-28 pt-[calc(100px_+_env(safe-area-inset-top))]">
        <h1 className="text-2xl font-black">経費申請</h1>
        <p className="mt-1 text-sm text-slate-500">実際に支払った税込金額を入力</p>

        <div className="mt-5 rounded-3xl bg-[#0f1e2d] p-5 text-white shadow-lg">
          <p className="text-xs font-bold text-slate-300">今月入力済み</p>
          <p className="mt-1 text-3xl font-black">¥{total.toLocaleString()}</p>
          <p className="mt-2 text-xs text-slate-400">交通費・宿泊費は税込金額から税抜額と税分を自動計算します。</p>
        </div>

        {(autoKm || autoFixed.length > 0) && (
          <div className="mt-4 rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
            <p className="text-sm font-black">✅ 次の経費は自動で入ります（入力しないでください）</p>
            <ul className="mt-2 space-y-1 text-xs font-bold">
              {autoKm && <li>・ガソリン代：出勤した店の距離から、毎月自動で計算されます（高速代・駐車場代だけ、下から申請してください）</li>}
              {autoFixed.map((r) => (
                <li key={r.id}>・{r.label}：毎月 ¥{(r.amount ?? 0).toLocaleString()}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-emerald-800">自動で入った分は、下の一覧に「承認済み」で出ます。同じものを申請すると二重になります。</p>
          </div>
        )}

        <form action={addExpense} className="mt-4 space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <input type="hidden" name="yearMonth" value={ym} />
          <div className="grid grid-cols-[2fr_3fr] gap-3">
            <label className="block min-w-0 text-xs font-black">
              日付（交通費は空欄でもOK）
              <input type="date" name="expenseDate" className="mt-1 w-full min-w-0 rounded-xl border px-2 py-3 text-sm" />
            </label>
            <label className="block min-w-0 text-xs font-black">
              区分
              <select name="category" className="mt-1 w-full min-w-0 rounded-xl border p-3 text-sm">
                <option value="TRAVEL">交通費</option>
                <option value="LODGING">宿泊費</option>
                <option value="OTHER">その他経費</option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-black">
            対象月（交通費で日付を空欄にしたときに使います）
            <input type="month" name="expenseMonth" defaultValue={ym} className="mt-1 w-full rounded-xl border p-3 text-sm" />
          </label>
          <label className="block text-xs font-black">
            対象案件
            <select name="workOrderStaffId" className="mt-1 w-full rounded-xl border p-3 text-sm">
              <option value="">指定なし</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.workOrder.client.name} / {a.workOrder.defaultStoreName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-black">
            税込金額
            <input name="amountTaxInclusive" type="number" min="0" required className="mt-1 w-full rounded-xl border p-3 text-sm" />
          </label>
          <label className="block text-xs font-black">
            内容・備考
            <textarea name="description" rows={2} className="mt-1 w-full rounded-xl border p-3 text-sm" placeholder="その他経費は必須" />
          </label>
          <SubmitButton className="w-full rounded-2xl bg-[#b91c1c] py-3 font-black text-white shadow-[0_4px_0_#7f1d1d]">経費を申請する</SubmitButton>
        </form>

        <section className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
          {items.length ? (
            items.map((x) => (
              <div key={x.id} className="border-b p-4 last:border-0">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">
                      {label(x.category)} <span className="ml-1 text-xs font-bold text-slate-400">{formatJst(x.expenseDate).slice(0, 10)}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{x.description || "—"}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      税抜 ¥{x.amountExTax.toLocaleString()} / 税 ¥{x.taxAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black">¥{x.amountTaxInclusive.toLocaleString()}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{x.status}</p>
                    {x.status === "DRAFT" && (
                      <form action={deleteDraftExpense.bind(null, x.id)}>
                        <SubmitButton className="mt-2 text-xs font-bold text-red-600">削除</SubmitButton>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="p-5 text-sm text-slate-400">まだ経費はありません。</p>
          )}
        </section>
      </div>
      <BottomTabBar />
    </main>
  );
}
