"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { deleteBotFaq, moveBotFaq, setBotFaqVisible } from "./actions";

type FaqRow = {
  id: string;
  category: string;
  question: string;
  answer: string;
  visible: boolean;
};

export function FaqList({ items }: { items: FaqRow[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function move(id: string, direction: "up" | "down") {
    startTransition(async () => {
      await moveBotFaq(id, direction);
      router.refresh();
    });
  }

  function toggleVisible(id: string, visible: boolean) {
    startTransition(async () => {
      await setBotFaqVisible(id, !visible);
      router.refresh();
    });
  }

  function handleDelete(id: string, question: string) {
    if (!window.confirm(`「${question}」を削除します。元に戻せません。削除しますか？`)) return;
    startTransition(async () => {
      await deleteBotFaq(id);
      router.refresh();
    });
  }

  if (items.length === 0) {
    return <p className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-500">FAQはまだ登録されていません。</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, index) => (
        <article
          key={item.id}
          className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/30 ${item.visible ? "" : "opacity-50"}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-black text-slate-400">
                {item.category}
              </span>
              <p className="mt-1.5 font-black text-slate-100">{item.question}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-400">{item.answer}</p>
              {!item.visible && (
                <span className="mt-1.5 inline-block rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-300">
                  非表示中
                </span>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(item.id, "up")}
                  disabled={pending || index === 0}
                  aria-label="上へ"
                  className="rounded-lg border border-slate-700 p-1.5 text-slate-300 disabled:opacity-30"
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => move(item.id, "down")}
                  disabled={pending || index === items.length - 1}
                  aria-label="下へ"
                  className="rounded-lg border border-slate-700 p-1.5 text-slate-300 disabled:opacity-30"
                >
                  <ChevronDown size={15} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => toggleVisible(item.id, item.visible)}
                disabled={pending}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-black ${
                  item.visible
                    ? "border-emerald-700 text-emerald-300"
                    : "border-slate-700 text-slate-400"
                }`}
              >
                {item.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                {item.visible ? "表示中" : "非表示"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-3 border-t border-slate-800 pt-3 text-xs font-black">
            <Link href={`/admin/bot/faqs/${item.id}`} className="text-blue-400 underline">
              編集
            </Link>
            <button
              type="button"
              onClick={() => handleDelete(item.id, item.question)}
              disabled={pending}
              className="text-red-400 underline disabled:opacity-50"
            >
              削除
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
