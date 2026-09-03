import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJst, listMonthOptions, yearMonthLabel } from "@/lib/time";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { addCompensationRequest, deleteDraftCompensationRequest } from "./actions";

const categoryLabel = (c: string) =>
  c === "REFERRAL" ? "リファラル報酬" : c === "INCENTIVE" ? "インセンティブ" : "その他";
const statusLabel = (s: string) =>
  s === "DRAFT" ? "下書き" : s === "SUBMITTED" ? "申請中" : s === "APPROVED" ? "承認済み" : s === "REJECTED" ? "却下" : s;

export default async function CompensationRequestPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.status !== "ACTIVE") redirect("/");

  const items = await prisma.compensationRequest.findMany({
    where: { staffId },
    orderBy: { createdAt: "desc" },
  });
  const monthOptions = listMonthOptions(6, 0);

  return (
    <main className="min-h-dvh bg-[#f5f6f8] text-slate-900">
      <div className="mx-auto max-w-md px-4 pb-28 pt-6">
        <Link href="/menu" className="text-sm font-bold text-slate-500">
          ← メニューへ戻る
        </Link>
        <h1 className="mt-3 text-2xl font-black">別途報酬申請</h1>
        <p className="mt-1 text-sm text-slate-500">リファラル報酬・インセンティブなど、通常のシフト稼働以外の報酬を申請します。</p>

        <form action={addCompensationRequest} className="mt-5 space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <label className="block text-xs font-black">
            対象月
            <select name="yearMonth" defaultValue={monthOptions.at(-1)?.value} className="mt-1 w-full min-w-0 rounded-xl border p-3 text-sm">
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-black">
            区分
            <select name="category" className="mt-1 w-full min-w-0 rounded-xl border p-3 text-sm">
              <option value="REFERRAL">リファラル報酬</option>
              <option value="INCENTIVE">インセンティブ</option>
              <option value="OTHER">その他</option>
            </select>
          </label>
          <label className="block text-xs font-black">
            税込金額
            <input name="amountTaxInclusive" type="number" min="0" required className="mt-1 w-full rounded-xl border p-3 text-sm" />
          </label>
          <label className="block text-xs font-black">
            内訳
            <textarea name="description" rows={2} className="mt-1 w-full rounded-xl border p-3 text-sm" placeholder="対象や算定根拠など" />
          </label>
          <button className="w-full rounded-2xl bg-[#b91c1c] py-3 font-black text-white shadow-[0_4px_0_#7f1d1d]">別途報酬を申請する</button>
        </form>

        <section className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
          {items.length ? (
            items.map((x) => (
              <div key={x.id} className="border-b p-4 last:border-0">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">
                      {categoryLabel(x.category)} <span className="ml-1 text-xs font-bold text-slate-400">{yearMonthLabel(x.yearMonth)}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{x.description || "—"}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatJst(x.createdAt).slice(0, 16)} 申請</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black">¥{x.amountTaxInclusive.toLocaleString()}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{statusLabel(x.status)}</p>
                    {x.status === "DRAFT" && (
                      <form action={deleteDraftCompensationRequest.bind(null, x.id)}>
                        <button className="mt-2 text-xs font-bold text-red-600">削除</button>
                      </form>
                    )}
                  </div>
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
