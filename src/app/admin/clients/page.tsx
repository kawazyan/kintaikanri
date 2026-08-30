import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../admin-nav";
import { ExternalLink } from "lucide-react";
import { ClientsList } from "./clients-list";

export default async function ClientsPage() {
  await requireAdmin();
  const clients = await prisma.client.findMany({
    include: { _count: { select: { workOrders: true, invoices: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const requestUrl = `${baseUrl}/client` || "/client";

  return <main className="mx-auto max-w-6xl px-4 py-8 text-slate-900"><AdminNav />
    <div className="rounded-[28px] bg-[#14283b] p-6 text-white shadow-[0_16px_44px_rgba(20,40,59,.18)]">
      <p className="text-[11px] font-black tracking-[.18em] text-slate-300">CLIENT PORTAL</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-black">取引先・依頼窓口</h1><p className="mt-2 text-sm font-bold text-slate-300">取引先の事前登録は不要です。下のURLを案内すると、そのまま稼働依頼を送信できます。</p></div><a href="/client" target="_blank" className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#14283b] shadow-[0_4px_0_#cbd5e1]"><ExternalLink size={16}/>取引先画面を開く</a></div>
      <div className="mt-5 rounded-2xl bg-black/15 p-4"><p className="text-xs font-black text-slate-300">取引先用URL</p><p className="mt-1 break-all font-black">{requestUrl}</p></div>
    </div>

    <section className="mt-6"><div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-black tracking-widest text-slate-400">AUTO CREATED</p><h2 className="text-lg font-black">依頼実績のある取引先</h2></div><span className="text-sm font-black text-slate-400">{clients.length}社</span></div>
      <ClientsList clients={clients} />
    </section>
  </main>;
}
