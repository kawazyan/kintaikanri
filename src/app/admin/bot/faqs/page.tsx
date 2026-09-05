import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../../admin-nav";
import { FaqList } from "./faq-list";

export default async function AdminBotFaqsPage() {
  await requireAdmin();
  const faqs = await prisma.botFaq.findMany({
    orderBy: [{ audience: "asc" }, { sortOrder: "asc" }],
  });

  const staffFaqs = faqs.filter((f) => f.audience === "STAFF");
  const clientFaqs = faqs.filter((f) => f.audience === "CLIENT");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <AdminNav />
      <div className="mb-2 text-sm">
        <Link href="/admin/bot" className="text-blue-400 underline">
          ← BOT管理へ戻る
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
          FAQ管理
        </h1>
        <Link
          href="/admin/bot/faqs/new"
          className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-1.5 text-sm text-white shadow-md shadow-blue-950/50 active:scale-[0.98]"
        >
          + 新規FAQ追加
        </Link>
      </div>
      <p className="mb-6 text-xs text-slate-500">
        ここで登録した内容は、保存するとすぐにBOTの回答に反映されます。非表示にしたFAQはBOTの一覧・回答どちらにも使われません。
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-black text-slate-300">スタッフ向け(K.J サポートBOT)</h2>
        <FaqList items={staffFaqs} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-black text-slate-300">取引先向け(K.J ご案内BOT)</h2>
        <FaqList items={clientFaqs} />
      </section>
    </main>
  );
}
