import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/url";
import { AdminNav } from "../admin-nav";
import { ExternalLink } from "lucide-react";
import { ClientsList } from "./clients-list";
import { AddClientForm } from "./add-client-form";

export default async function ClientsPage() {
  await requireAdmin();
  const [clients, baseUrl] = await Promise.all([
    prisma.client.findMany({
      include: {
        _count: { select: { workOrders: true, invoices: true } },
        viewTokens: { where: { active: true }, select: { token: true }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    }),
    getBaseUrl(),
  ]);

  return <main className="mx-auto max-w-6xl px-4 py-8 text-slate-900"><AdminNav />
    <h1 className="kj-page-title">取引先・依頼窓口</h1>
    <div className="flex justify-end"><a href="/admin/clients/unassigned" className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#14283b] shadow-[0_4px_0_#cbd5e1] ring-1 ring-black/10"><ExternalLink size={16}/>クライアント未確定のシフト</a></div>

    <AddClientForm />

    <section className="mt-6"><div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-black tracking-widest text-slate-400">CLIENTS</p><h2 className="text-lg font-black">取引先一覧</h2></div><span className="text-sm font-black text-slate-400">{clients.length}社</span></div>
      <ClientsList clients={clients.map(({ viewTokens, ...c }) => ({ ...c, viewUrl: viewTokens[0] ? `${baseUrl}/watch/${viewTokens[0].token}` : null }))} />
    </section>
  </main>;
}
