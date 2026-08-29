import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../admin-nav";
import { createClient, rotateClientToken, stopClientSharing } from "./actions";

export default async function ClientsPage() {
  await requireAdmin();
  const clients = await prisma.client.findMany({ include: { accessTokens: { where: { active: true }, orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { workOrders: true } } }, orderBy: { createdAt: "desc" } });
  return <main className="mx-auto max-w-5xl px-4 py-8 text-slate-100"><AdminNav /><h1 className="mb-6 text-2xl font-black">取引先管理</h1>
    <form action={createClient} className="mb-8 grid gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-5 md:grid-cols-2">
      <input name="name" required placeholder="取引先名" className="rounded-xl bg-slate-800 px-4 py-3" />
      <input name="clientCode" required placeholder="取引先コード（例 YAMASE）" className="rounded-xl bg-slate-800 px-4 py-3" />
      <input name="contactName" placeholder="担当者名" className="rounded-xl bg-slate-800 px-4 py-3" />
      <input name="phone" placeholder="電話番号" className="rounded-xl bg-slate-800 px-4 py-3" />
      <input name="email" type="email" placeholder="メールアドレス" className="rounded-xl bg-slate-800 px-4 py-3" />
      <button className="rounded-xl bg-red-600 px-4 py-3 font-black">取引先を登録</button>
    </form>
    <div className="space-y-3">{clients.map(c => { const t=c.accessTokens[0]; return <article key={c.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black">{c.name}</h2><p className="text-sm text-slate-400">{c.clientCode} ・ 稼働依頼 {c._count.workOrders}件</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${t?"bg-emerald-500/15 text-emerald-300":"bg-slate-700 text-slate-400"}`}>{t?"共有中":"共有停止中"}</span></div>
      <p className="mt-3 text-sm text-slate-300">担当：{c.contactName||"未設定"}　{c.phone||""}　{c.email||""}</p>
      {t && <div className="mt-3 rounded-xl bg-slate-950 p-3 text-xs text-slate-400 break-all">取引先URL：/client/{t.token}</div>}
      <div className="mt-4 flex gap-2"><form action={rotateClientToken.bind(null,c.id)}><button className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-bold">URLを再発行</button></form><form action={stopClientSharing.bind(null,c.id)}><button className="rounded-lg border border-red-800 px-3 py-2 text-xs font-bold text-red-300">共有を停止</button></form></div>
    </article>})}</div>
  </main>;
}
