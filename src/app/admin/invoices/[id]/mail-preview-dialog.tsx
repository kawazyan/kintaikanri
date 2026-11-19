"use client";

import type { MailPreview } from "../actions";

// 送信・再送の前に出す確認画面。実際に送られる件名・本文・宛先・添付をそのまま見せる。
// 初回送信=青、再送=オレンジのラベルで区別する。
export function MailPreviewDialog({
  preview,
  note,
  pending,
  onConfirm,
  onClose,
}: {
  preview: MailPreview;
  note?: string; // 送信と一緒に行う処理の説明(例: 追加した宛先の保存)
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const resend = preview.mode === "resend";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 text-slate-900 shadow-2xl">
        <span className={`inline-block rounded-full px-3 py-1 text-sm font-black text-white ${resend ? "bg-amber-600" : "bg-blue-600"}`}>{resend ? "再送" : "初回送信"}</span>
        {preview.isCorrection && <span className="ml-2 inline-block rounded-full bg-red-600 px-3 py-1 text-sm font-black text-white">訂正版</span>}
        <h3 className="mt-2 font-black">{resend ? "この内容でメールを再送します" : "この内容でメールを送ります"}</h3>

        <p className="mt-3 text-xs font-bold text-slate-500">宛先</p>
        <p className="mt-1 break-all text-sm leading-relaxed">{preview.to.map((x) => <span key={x} className="block">{x}</span>)}</p>
        {preview.cc.length > 0 && <p className="mt-1 break-all text-xs text-slate-500">CC: {preview.cc.join(", ")}</p>}

        <p className="mt-3 text-xs font-bold text-slate-500">件名</p>
        <p className="mt-1 rounded-lg bg-slate-100 p-2 text-sm font-black">{preview.subject}</p>

        <p className="mt-3 text-xs font-bold text-slate-500">添付</p>
        <p className="mt-1 break-all text-xs">{preview.attachments.join(" ・ ")}</p>

        <p className="mt-3 text-xs font-bold text-slate-500">本文</p>
        <pre className="mt-1 whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 font-sans text-xs leading-relaxed">{preview.text}</pre>

        {note && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-800">{note}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} disabled={pending} className="flex-1 rounded-xl bg-slate-200 px-4 py-3 text-sm font-black disabled:opacity-50">
            戻る
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className={`flex-1 rounded-xl px-4 py-3 text-sm font-black text-white disabled:opacity-50 ${resend ? "bg-amber-600" : "bg-blue-600"}`}>
            {pending ? "送信中..." : resend ? "再送する" : "送信する"}
          </button>
        </div>
      </div>
    </div>
  );
}
