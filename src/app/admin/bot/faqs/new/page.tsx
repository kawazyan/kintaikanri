import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "../../../admin-nav";
import { createBotFaq } from "../actions";

const FIELD_CLASS =
  "rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

export default async function NewBotFaqPage() {
  await requireAdmin();

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <AdminNav />
      <div className="mb-2 text-sm">
        <Link href="/admin/bot/faqs" className="text-blue-400 underline">
          ← FAQ管理へ戻る
        </Link>
      </div>
      <h1 className="mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        新規FAQ追加
      </h1>

      <form action={createBotFaq} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          表示対象
          <select name="audience" defaultValue="STAFF" className={FIELD_CLASS}>
            <option value="STAFF">スタッフ向け(K.J サポートBOT)</option>
            <option value="CLIENT">取引先向け(K.J ご案内BOT)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          カテゴリ
          <input
            type="text"
            name="category"
            required
            placeholder="例: 勤怠、支払、申請 など"
            className={FIELD_CLASS}
          />
          <span className="text-xs text-slate-500">BOTのトピック一覧でグループ分けに使われます。既存と同じ文言にすると同じグループに入ります。</span>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          質問(トピックのボタンに表示されます)
          <input type="text" name="question" required placeholder="例: シフトを確認・変更したい" className={FIELD_CLASS} />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          回答
          <textarea name="answer" required rows={5} placeholder="BOTが返す回答文を入力してください" className={FIELD_CLASS} />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          追加キーワード(任意)
          <input type="text" name="keywords" placeholder="例: シフト,予定,休み" className={FIELD_CLASS} />
          <span className="text-xs text-slate-500">
            質問文以外にも、この言葉が含まれていたらこのFAQを回答候補にします。カンマ区切りで複数入力できます。空欄でも質問文自体で検索されます。
          </span>
        </label>

        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-white shadow-lg shadow-blue-950/50 active:scale-[0.98]"
        >
          この内容で追加する
        </button>
      </form>
    </main>
  );
}
