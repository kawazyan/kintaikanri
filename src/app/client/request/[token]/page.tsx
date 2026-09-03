import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { syncWorkOrderShiftLinks } from "@/lib/work-order-linking";
import { ClientAutoRefresh } from "../../components/auto-refresh";

const requestLabels = { CATCH: "キャッチ", CLOSER: "クローザー", BAND: "帯稼働", CONSULTING: "コンサルティング" } as const;
const statusLabels: Record<string, string> = { PENDING_APPROVAL: "承認待ち", APPROVED: "承認済み", CHANGES_PENDING: "変更確認中", CANCELLED: "キャンセル", TERMINATED: "途中終了" };
const travelLabels: Record<string,string> = { INCLUDED:"単価に込み", SEPARATE:"別途請求", CONSULT:"要相談" };

export default async function ClientRequestStatusPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const { token } = await params;
  const search = await searchParams;
  const access = await prisma.workOrderAccessToken.findUnique({ where: { token }, include: { workOrder: true } });
  if (!access?.active) notFound();

  // 帯稼働などで月の途中にシフトが追加登録されていくケースでも、取引先が
  // このページを開くたび(自動更新も含む)に最新の紐づけへ同期させる。
  await syncWorkOrderShiftLinks(access.workOrderId);

  const o = await prisma.workOrder.findUnique({
    where: { id: access.workOrderId },
    include: {
      client: true,
      scheduleDays: { orderBy: { workDate: "asc" } },
      staffAssignments: { include: { staff: true, shifts: { include: { clockRecords: true }, orderBy: { startTime: "asc" } } } },
      invoices: { include: { invoice: true } },
    },
  });
  if (!o) notFound();
  const invoices = o.invoices.map((x)=>x.invoice).filter((i)=>["FINALIZED","REISSUED"].includes(i.status));
  const first = o.staffAssignments[0];

  return <><ClientAutoRefresh/><main className="min-h-dvh bg-[linear-gradient(180deg,#edf1f4,#f8fafb)] text-slate-900"><div className="mx-auto max-w-4xl px-4 py-8">
    {search.submitted === "1" && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-800">稼働依頼を送信しました。管理者の承認をお待ちください。このページのURLから進捗を確認できます。</div>}
    <header className="rounded-[28px] bg-[#14283b] p-6 text-white shadow-[0_16px_44px_rgba(20,40,59,.22)]"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black tracking-[.18em] text-slate-300">REQUEST STATUS</p><h1 className="mt-1 text-2xl font-black">{o.client.name} 様</h1><p className="mt-2 text-sm font-bold text-slate-300">{o.yearMonth} ・ {requestLabels[o.requestType]}</p></div><span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black">{statusLabels[o.status] ?? o.status}</span></div></header>

    <section className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-black/5"><p className="text-xs font-black tracking-widest text-slate-400">依頼内容</p><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-400">キャリア</dt><dd className="font-black">{o.requestedCarrier || "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">稼働場所</dt><dd className="font-black">{o.defaultStoreName}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">稼働者</dt><dd className="text-right font-black">{o.staffAssignments.map(a=>a.staff?.name ?? a.requestedName).join(" / ")}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">単価</dt><dd className="font-black">{first ? `${first.contractType === "MONTHLY" ? "月額" : "日額"} ¥${first.rateAmountExTax.toLocaleString("ja-JP")}（税抜）` : "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">交通費</dt><dd className="font-black">{first ? travelLabels[first.travelExpense] : "—"}</dd></div></dl></div>
    <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-black/5"><p className="text-xs font-black tracking-widest text-slate-400">稼働予定</p>{o.requestType === "BAND" ? <div className="mt-4"><p className="text-2xl font-black">{o.plannedDays}<span className="ml-1 text-sm">日予定</span></p><p className="mt-2 text-sm font-bold text-slate-500">具体的な稼働日はスタッフ・管理者側のシフトで管理されます。</p>{o.schedulePattern === "FIXED" && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-black">基本時間 {o.fixedStartTime}〜{o.fixedEndTime}</p>}</div> : <div className="mt-3 space-y-2">{o.scheduleDays.map(d=><div key={d.id} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><b>{formatJst(d.workDate).slice(0,10)}</b><span>{d.startTime || o.fixedStartTime}〜{d.endTime || o.fixedEndTime}</span></div>)}</div>}</div></section>

    <section className="mt-5 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-black/5"><div className="flex items-end justify-between"><div><p className="text-xs font-black tracking-widest text-slate-400">ATTENDANCE</p><h2 className="mt-1 text-lg font-black">勤務状況</h2></div><span className="text-xs font-bold text-slate-400">約8秒ごとに更新</span></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-400"><th className="py-3">日付</th><th>稼働者</th><th>稼働場所</th><th>予定</th><th>出勤</th><th>退勤</th><th>状態</th></tr></thead><tbody>{o.staffAssignments.flatMap(a=>a.shifts.map(sh=>{const ins=sh.clockRecords.filter(r=>r.type==="IN").sort((a,b)=>a.timestamp.getTime()-b.timestamp.getTime());const outs=sh.clockRecords.filter(r=>r.type==="OUT").sort((a,b)=>a.timestamp.getTime()-b.timestamp.getTime());const inn=ins[0],out=outs.at(-1);return <tr key={sh.id} className="border-b last:border-0"><td className="py-3 font-bold">{formatJst(sh.startTime).slice(0,10)}</td><td className="font-bold">{a.staff?.name ?? a.requestedName}</td><td>{sh.storeName}</td><td>{formatJst(sh.startTime).slice(-5)}〜{formatJst(sh.endTime).slice(-5)}</td><td>{inn?formatJst(inn.timestamp).slice(-5):"—"}</td><td>{out?formatJst(out.timestamp).slice(-5):"—"}</td><td><b>{sh.cancelledAt?"キャンセル":out?"退勤済み":inn?"稼働中":"未出勤"}</b></td></tr>}))}</tbody></table>{!o.staffAssignments.some(a=>a.shifts.length) && <p className="py-8 text-center text-sm font-bold text-slate-400">管理者がシフトを紐付けると、ここに勤務状況が表示されます。</p>}</div></section>

    <section className="mt-5 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-black/5"><p className="text-xs font-black tracking-widest text-slate-400">BILLING</p><h2 className="mt-1 text-lg font-black">請求書・勤務明細</h2>{invoices.length ? <div className="mt-4 space-y-2">{invoices.map(i=><div key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"><div><b>{i.yearMonth} 請求書</b><p className="text-xs text-slate-400">{i.invoiceNumber}</p></div><div className="flex items-center gap-2"><b>¥{i.totalInclTax.toLocaleString("ja-JP")}</b><Link href={`/invoice/${i.id}/print`} className="rounded-xl bg-[#14283b] px-3 py-2 text-xs font-black text-white">請求書</Link><Link href={`/invoice/${i.id}/detail`} className="rounded-xl border px-3 py-2 text-xs font-black">勤務・請求明細</Link></div></div>)}</div> : <p className="mt-3 text-sm font-bold text-slate-400">請求確定後、ここからPDFを確認できます。</p>}</section>
    <div className="mt-7 text-center"><Link href="/client" className="text-sm font-black text-[#14283b]">新しい稼働依頼を作成する</Link></div>
  </div></main></>;
}
