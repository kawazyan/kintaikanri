import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../../../admin-nav";
import { updateBotFaq } from "../actions";

const FIELD_CLASS =
  "rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

export default async function EditBotFaqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const faq = await prisma.botFaq.findUnique({ where: { id } });
  if (!faq) notFound();

  const boundAction = updateBotFaq.bind(null, faq.id);

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <AdminNav />
      <div className="mb-2 text-sm">
        <Link href="/admin/bot/faqs" className="text-blue-400 underline">
          ← FAQ管理へ戻る
        </Link>
      </div>
      <h1 className="mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        FAQの編集
      </h1>

      <form action={boundAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          表示対象
          <select name="audience" defaultValue={faq.audience} className={FIELD_CLASS}>
            <option value="STAFF">スタッフ向け(K.J サポートBOT)</option>
            <option value="CLIENT">取引先向け(K.J ご案内BOT)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          カテゴリ
          <input type="text" name="category" required defaultValue={faq.category} className={FIELD_CLASS} />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          質問(トピックのボタンに表示されます)
          <input type="text" name="question" required defaultValue={faq.question} className={FIELD_CLASS} />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          回答
          <textarea name="answer" required rows={5} defaultValue={faq.answer} className={FIELD_CLASS} />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          追加キーワード(任意)
          <input type="text" name="keywords" defaultValue={faq.keywords ?? ""} className={FIELD_CLASS} />
          <span className="text-xs text-slate-500">カンマ区切りで複数入力できます。</span>
        </label>

        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-white shadow-lg shadow-blue-950/50 active:scale-[0.98]"
        >
          保存する
        </button>
      </form>
    </main>
  );
}
