import { ClientAutoRefresh } from "../../../components/auto-refresh";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import {
  updateClientOrder,
  addClientDailyOverride,
  clientCancelOrder,
  clientCancelAssignment,
  clientCancelShift,
  clientCancelSite,
} from "./actions";

const contractLabel = (v: string) => (v === "MONTHLY" ? "月単価" : "日単価");
const absenceLabel = (v: string) => (v === "YES" ? "あり" : v === "NO" ? "なし" : "要相談");
const travelLabel = (v: string) => (v === "INCLUDED" ? "込み" : v === "SEPARATE" ? "別" : "要相談");

export default async function RequestDetail({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const access = await prisma.clientAccessToken.findUnique({ where: { token } });
  if (!access?.active) notFound();

  const o = await prisma.workOrder.findFirst({
    where: { id, clientId: access.clientId },
    include: {
      client: true,
      staffAssignments: {
        include: {
          staff: true,
          shifts: { include: { clockRecords: true }, orderBy: { startTime: "asc" } },
          dailyOverrides: { orderBy: { createdAt: "desc" } },
        },
      },
      sites: true,
      histories: { orderBy: { changedAt: "desc" }, take: 30 },
    },
  });
  if (!o) notFound();

  return (
    <>
      <ClientAutoRefresh />
      <main className="min-h-dvh bg-[#f4f5f7] text-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <Link href={`/client/${token}`} className="text-sm font-bold text-slate-500">← 戻る</Link>

          <div className="mt-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs font-black text-slate-400">{o.yearMonth}</p>
                <h1 className="text-2xl font-black">{o.defaultStoreName}</h1>
              </div>
              <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{o.status}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-400">予定日数</p><p className="mt-1 text-xl font-black">{o.plannedDays}日</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-400">担当者</p><p className="mt-1 font-black">{o.clientContactName}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-400">K.J承認</p><p className="mt-1 font-black">{o.approverName || "承認待ち"}</p></div>
            </div>
          </div>

          <section className="mt-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-lg font-black">スタッフ・契約条件</h2>
            {o.staffAssignments.map((s) => (
              <div key={s.id} className="mt-4 rounded-2xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-black">{s.staff?.name ?? s.requestedName}</h3>
                  <span className="text-sm font-black">{contractLabel(s.contractType)} ¥{s.rateAmountExTax.toLocaleString()}（税抜）</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">欠勤時の減算：{absenceLabel(s.absenceDeduction)}　交通費：{travelLabel(s.travelExpense)}</p>
                {!s.active && <p className="mt-2 text-xs font-black text-red-600">このスタッフの稼働はキャンセル済みです。</p>}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[650px] text-sm">
                    <thead><tr className="text-left text-xs text-slate-400"><th className="pb-2">日付</th><th>店舗</th><th>予定</th><th>出勤</th><th>退勤</th><th>状況</th></tr></thead>
                    <tbody>
                      {s.shifts.map((sh) => {
                        const inn = sh.clockRecords.find((r) => r.type === "IN");
                        const out = [...sh.clockRecords].reverse().find((r) => r.type === "OUT");
                        const status = sh.cancelledAt ? "キャンセル" : inn && out ? "勤務完了" : inn ? "勤務中" : "未出勤";
                        return (
                          <tr key={sh.id} className="border-t">
                            <td className="py-2">{formatJst(sh.startTime).slice(0, 10)}</td><td>{sh.storeName}</td>
                            <td>{formatJst(sh.startTime).slice(-5)}–{formatJst(sh.endTime).slice(-5)}</td>
                            <td>{inn ? formatJst(inn.timestamp).slice(-5) : "--:--"}</td><td>{out ? formatJst(out.timestamp).slice(-5) : "--:--"}</td><td>{status}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>

          <section className="mt-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-lg font-black">内容を変更する</h2>
            <p className="mt-1 text-xs text-slate-400">承認後に金額や条件を変えた場合は、K.J側で再確認になります。</p>
            <form action={updateClientOrder.bind(null, token, id)} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-black">予定日数<input name="plannedDays" type="number" min="1" defaultValue={o.plannedDays} className="mt-1 w-full rounded-xl border p-3" /></label>
              <label className="text-xs font-black">主な稼働先<input name="defaultStoreName" defaultValue={o.defaultStoreName} className="mt-1 w-full rounded-xl border p-3" /></label>
              <label className="text-xs font-black">単価（税抜）<input name="rateAmountExTax" type="number" min="0" defaultValue={o.staffAssignments[0]?.rateAmountExTax || 0} className="mt-1 w-full rounded-xl border p-3" /></label>
              <label className="text-xs font-black">交通費<select name="travelExpense" defaultValue={o.staffAssignments[0]?.travelExpense || "CONSULT"} className="mt-1 w-full rounded-xl border p-3"><option value="INCLUDED">込み</option><option value="SEPARATE">別</option><option value="CONSULT">要相談</option></select></label>
              <input name="actorName" required placeholder="変更する担当者名" className="rounded-xl border p-3" />
              <input name="reason" placeholder="変更理由" className="rounded-xl border p-3" />
              <button className="sm:col-span-2 rounded-2xl bg-slate-900 py-3 font-black text-white">変更内容を送信</button>
            </form>
          </section>

          <section className="mt-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-lg font-black">当日の変更</h2>
            <p className="mt-1 text-xs text-slate-400">急な店舗変更・単価変更・交通費条件変更を、その日だけ上書きできます。</p>
            <form action={addClientDailyOverride.bind(null, token, id)} className="mt-4 grid gap-3 sm:grid-cols-2">
              <select name="assignmentId" required className="rounded-xl border p-3"><option value="">スタッフを選択</option>{o.staffAssignments.map((s) => <option key={s.id} value={s.id}>{s.staff?.name ?? s.requestedName}</option>)}</select>
              <input name="workDate" type="date" required className="rounded-xl border p-3" />
              <input name="changedStoreName" placeholder="変更後の店舗・現場" className="rounded-xl border p-3" />
              <input name="changedRateExTax" type="number" min="0" placeholder="変更後単価（税抜・任意）" className="rounded-xl border p-3" />
              <select name="changedTravelExpense" className="rounded-xl border p-3"><option value="">交通費条件変更なし</option><option value="INCLUDED">込み</option><option value="SEPARATE">別</option><option value="CONSULT">要相談</option></select>
              <label className="flex items-center gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" name="lodgingOccurred" />宿泊あり</label>
              <input name="otherExpenseNote" placeholder="その他追加経費など" className="rounded-xl border p-3" />
              <input name="actorName" required placeholder="担当者名" className="rounded-xl border p-3" />
              <textarea name="reason" required placeholder="変更理由" className="sm:col-span-2 rounded-xl border p-3" />
              <button className="sm:col-span-2 rounded-2xl bg-[#b91c1c] py-3 font-black text-white">当日変更を登録</button>
            </form>
          </section>

          <section className="mt-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-lg font-black">一部キャンセル</h2>
            <p className="mt-1 text-xs text-slate-400">スタッフ・日付・現場単位でキャンセルできます。元データは削除しません。</p>
            <div className="mt-4 space-y-6">
              <div>
                <p className="text-sm font-black">スタッフ単位</p>
                {o.staffAssignments.filter((s) => s.active).map((s) => (
                  <form key={s.id} action={clientCancelAssignment.bind(null, token, id, s.id)} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
                    <div className="rounded-xl bg-slate-50 p-3 text-sm font-bold">{s.staff?.name ?? s.requestedName}</div>
                    <input name="actorName" required placeholder="担当者名" className="rounded-xl border p-3" /><input name="reason" required placeholder="理由" className="rounded-xl border p-3" />
                    <button className="rounded-xl border border-red-300 px-3 font-black text-red-700">キャンセル</button>
                  </form>
                ))}
              </div>

              <div>
                <p className="text-sm font-black">日付単位</p>
                {o.staffAssignments.flatMap((s) => s.shifts.filter((sh) => !sh.cancelledAt).map((sh) => (
                  <form key={sh.id} action={clientCancelShift.bind(null, token, id, sh.id)} className="mt-2 grid gap-2 sm:grid-cols-[1.3fr_1fr_2fr_auto]">
                    <div className="rounded-xl bg-slate-50 p-3 text-sm font-bold">{formatJst(sh.startTime).slice(0, 10)} / {s.staff?.name ?? s.requestedName}</div>
                    <input name="actorName" required placeholder="担当者名" className="rounded-xl border p-3" /><input name="reason" required placeholder="理由" className="rounded-xl border p-3" />
                    <button className="rounded-xl border border-red-300 px-3 font-black text-red-700">この日をキャンセル</button>
                  </form>
                )))}
              </div>

              <div>
                <p className="text-sm font-black">現場単位</p>
                {o.sites.filter((site) => !site.cancelledAt).map((site) => (
                  <form key={site.id} action={clientCancelSite.bind(null, token, id, site.id)} className="mt-2 grid gap-2 sm:grid-cols-[1.3fr_1fr_2fr_auto]">
                    <div className="rounded-xl bg-slate-50 p-3 text-sm font-bold">{site.storeName}</div>
                    <input name="actorName" required placeholder="担当者名" className="rounded-xl border p-3" /><input name="reason" required placeholder="理由" className="rounded-xl border p-3" />
                    <button className="rounded-xl border border-red-300 px-3 font-black text-red-700">現場をキャンセル</button>
                  </form>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-red-100 bg-white p-6 shadow-sm">
            <h2 className="font-black text-red-700">依頼全体をキャンセル</h2>
            <p className="mt-1 text-xs text-slate-400">キャンセル料は自動で加算しません。元の依頼内容は履歴として残ります。</p>
            <form action={clientCancelOrder.bind(null, token, id)} className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <input name="actorName" required placeholder="担当者名" className="rounded-xl border p-3" /><input name="reason" required placeholder="キャンセル理由" className="rounded-xl border p-3" />
              <button className="rounded-xl border border-red-300 px-4 font-black text-red-700">キャンセル</button>
            </form>
          </section>

          <section className="mt-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-lg font-black">変更履歴</h2>
            {o.histories.length ? o.histories.map((h) => (
              <div key={h.id} className="border-b py-3 text-sm last:border-0"><p className="font-bold">{h.changeType} ・ {h.actorName}</p><p className="text-xs text-slate-400">{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(h.changedAt)}{h.reason ? ` ・ ${h.reason}` : ""}</p></div>
            )) : <p className="mt-3 text-sm text-slate-400">変更履歴はありません。</p>}
          </section>
        </div>
      </main>
    </>
  );
}
