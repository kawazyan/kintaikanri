"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App route error", error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[#05080b] px-5 text-white">
      <section className="w-full max-w-sm rounded-[24px] border border-white/15 bg-[#0c131a] p-6 text-center shadow-2xl">
        <p className="text-xs font-black tracking-[.16em] text-slate-500">TEMPORARY ERROR</p>
        <h1 className="mt-2 text-xl font-black">画面の読み込みに失敗しました</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">通信やデータベース接続が一時的に不安定な場合があります。再読み込みで復帰できるようにしています。</p>
        <button onClick={() => reset()} className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950">もう一度読み込む</button>
        <a href="/clock" className="mt-3 block rounded-xl border border-white/15 px-4 py-3 text-sm font-black">ホームへ戻る</a>
      </section>
    </main>
  );
}
