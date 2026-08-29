import { ClientAutoRefresh } from "../components/auto-refresh";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";

const statusLabel: Record<string,string> = {PENDING_APPROVAL:"承認待ち",APPROVED:"承認済み",CHANGES_PENDING:"変更確認中",CANCELLED:"キャンセル",TERMINATED:"途中終了"};

export default async function ClientPortalPage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  const access=await prisma.clientAccessToken.findUnique({where:{token},include:{client:true}});
  if(!access?.active||!access.client.active) notFound();
  const orders=await prisma.workOrder.findMany({where:{clientId:access.clientId},include:{staffAssignments:{include:{staff:true,shifts:{include:{clockRecords:true},orderBy:{startTime:"desc"}}}},client:true},orderBy:[{yearMonth:"desc"},{createdAt:"desc"}]});
  const invoices=await prisma.invoice.findMany({where:{clientId:access.clientId,status:{in:["FINALIZED","REISSUED"]}},orderBy:{createdAt:"desc"},take:12});
  return <><ClientAutoRefresh/><main className="min-h-dvh bg-[#f4f5f7] text-slate-900"><div className="mx-auto max-w-5xl px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-400">取引先ポータル</p><h1 className="text-2xl font-black">{access.client.name}</h1></div><Link href={`/client/${token}/requests/new`} className="rounded-xl bg-[#b91c1c] px-4 py-3 text-sm font-black text-white shadow-[0_4px_0_#7f1d1d]">稼働依頼を作成</Link></div>
    <section className="mt-7 grid gap-4 md:grid-cols-2">{orders.map(o=><Link key={o.id} href={`/client/${token}/requests/${o.id}`} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-slate-400">{o.yearMonth}</p><h2 className="mt-1 text-lg font-black">{o.defaultStoreName}</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{statusLabel[o.status]||o.status}</span></div><p className="mt-3 text-sm text-slate-500">予定 {o.plannedDays}日 ・ {o.staffAssignments.map(a=>(a.staff?.name ?? a.requestedName)).join(" / ")}</p><div className="mt-4 border-t pt-4"><p className="text-xs font-black text-slate-400">現在の勤怠</p>{o.staffAssignments.map(a=>{const shift=a.shifts[0];const inn=shift?.clockRecords.find(r=>r.type==="IN");const out=[...(shift?.clockRecords||[])].reverse().find(r=>r.type==="OUT");return <div key={a.id} className="mt-2 flex justify-between text-sm"><span className="font-bold">{(a.staff?.name ?? a.requestedName)}</span><span className="text-slate-500">{inn?`出勤 ${formatJst(inn.timestamp).slice(-5)}`:"未出勤"}{out?` / 退勤 ${formatJst(out.timestamp).slice(-5)}`:""}</span></div>})}</div></Link>)}</section>
    <section className="mt-8"><h2 className="mb-3 text-lg font-black">請求書</h2><div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">{invoices.length?invoices.map(i=><div key={i.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-0"><div><p className="font-black">{i.yearMonth} 請求書</p><p className="text-xs text-slate-400">{i.invoiceNumber}</p></div><div className="flex items-center gap-2"><span className="font-black">¥{i.totalInclTax.toLocaleString("ja-JP")}</span><Link href={`/invoice/${i.id}/print`} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">請求書</Link><Link href={`/invoice/${i.id}/detail`} className="rounded-lg border px-3 py-2 text-xs font-bold">勤務・請求明細</Link></div></div>):<p className="p-5 text-sm text-slate-400">確定済みの請求書はありません。</p>}</div></section>
  </div></main></>;
}
