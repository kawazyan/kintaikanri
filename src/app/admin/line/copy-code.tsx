"use client";

import { useState } from "react";

// 連携コード(「勤怠連携 ○○」の文)を大きく表示し、ワンタップでコピーできるようにする。
export function CopyCode({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // コピーに失敗しても、文は選択できる状態で表示している。
    }
  }

  return (
    <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
      <p className="text-xs font-black text-amber-800">このコードをLINEグループに送信してください</p>
      <p className="mt-2 break-all rounded-lg bg-white p-3 font-mono text-base font-bold text-slate-900 select-all">{text}</p>
      <button
        type="button"
        onClick={copy}
        className="mt-2 w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-black text-white active:translate-y-0.5 sm:w-auto"
      >
        {copied ? "コピーしました" : "コードをコピー"}
      </button>
    </div>
  );
}
