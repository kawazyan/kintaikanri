"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Send } from "lucide-react";
import { createNotice, updateNotice, deleteNotice } from "./actions";

type NoticeItem = {
  id: string;
  authorName: string;
  body: string;
  editedByName: string | null;
  createdAtLabel: string;
  updatedAtLabel: string;
  wasEdited: boolean;
};

const cardClass =
  "game-hud-frame game-cut-card rounded-[20px] p-4 shadow-[0_8px_24px_rgba(15,23,42,.07)] ring-1 ring-black/[.04]";
const textareaClass =
  "mt-2 w-full min-w-0 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-400/10";

export function NoticeBoard({ notices, staffName }: { notices: NoticeItem[]; staffName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newBody, setNewBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    const body = newBody.trim();
    if (!body) return;
    const fd = new FormData();
    fd.set("body", body);
    startTransition(async () => {
      await createNotice(fd);
      setNewBody("");
      router.refresh();
    });
  }

  function startEdit(item: NoticeItem) {
    setEditingId(item.id);
    setEditBody(item.body);
  }

  function submitEdit(e: React.FormEvent, id: string) {
    e.preventDefault();
    const body = editBody.trim();
    if (!body) return;
    const fd = new FormData();
    fd.set("body", body);
    startTransition(async () => {
      await updateNotice(id, fd);
      setEditingId(null);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("この投稿を削除します。よろしいですか？")) return;
    startTransition(async () => {
      await deleteNotice(id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submitNew} className={cardClass}>
        <p className="text-[13px] font-black text-slate-700">{staffName} さんとして投稿</p>
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          rows={3}
          placeholder="スタッフ全員に共有したい連絡事項を入力してください"
          className={textareaClass}
        />
        <button
          type="submit"
          disabled={pending || !newBody.trim()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 px-4 py-3 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_12px_rgba(220,38,38,0.4)] active:scale-[0.98] disabled:opacity-50"
        >
          <Send size={15} />
          投稿する
        </button>
      </form>

      {notices.map((item) => (
        <article key={item.id} className={cardClass}>
          {editingId === item.id ? (
            <form onSubmit={(e) => submitEdit(e, item.id)}>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={3}
                className={textareaClass}
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={pending || !editBody.trim()}
                  className="flex-1 rounded-xl bg-gradient-to-b from-red-400 via-[#e0272e] to-red-800 px-4 py-2.5 text-sm font-black text-white shadow-[0_4px_12px_rgba(220,38,38,0.3)] active:scale-[0.98] disabled:opacity-50"
                >
                  保存する
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-500 active:scale-[0.98]"
                >
                  キャンセル
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-red-50 to-slate-50 text-[13px] font-black text-red-600 ring-1 ring-red-100">
                    {item.authorName.slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-[13px] font-black text-slate-900">{item.authorName}</p>
                    <p className="text-[10px] font-bold text-slate-400">
                      {item.createdAtLabel}
                      {item.wasEdited && ` ・ ${item.editedByName}さんが編集 (${item.updatedAtLabel})`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    aria-label="編集"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:scale-[0.95]"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    aria-label="削除"
                    disabled={pending}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500 active:scale-[0.95] disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-700">
                {item.body}
              </p>
            </>
          )}
        </article>
      ))}
    </div>
  );
}
