import Link from "next/link";
import { ChevronRight, MessageCircleQuestion } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../admin-nav";

export default async function AdminBotHub() {
  await requireAdmin();
  const [staffCount, clientCount] = await Promise.all([
    prisma.botFaq.count({ where: { audience: "STAFF" } }),
    prisma.botFaq.count({ where: { audience: "CLIENT" } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <AdminNav />
      <h1 className="mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        BOT管理
      </h1>

      <Link
        href="/admin/bot/faqs"
        className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/40 backdrop-blur-sm transition active:scale-[0.99]"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/30">
          <MessageCircleQuestion size={26} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-black text-slate-100">FAQ管理</span>
          <span className="mt-0.5 block text-sm text-slate-400">
            スタッフ用サポートBOT・取引先用案内BOTの質問と回答を管理します
          </span>
          <span className="mt-2 block text-xs text-slate-500">
            スタッフ向け {staffCount}件 ・ 取引先向け {clientCount}件
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-slate-500" />
      </Link>
    </main>
  );
}
