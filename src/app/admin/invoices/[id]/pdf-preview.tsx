"use client";

import { useEffect, useRef, useState } from "react";

// PDFをダウンロードせずに画面内へ表示する(スマホでもそのまま見られる)。
// pdf.js でページごとに canvas へ描画する。
export function PdfPreview({ url, title }: { url: string; title: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const box = boxRef.current;
    if (!box) return;
    box.replaceChildren();
    setState("loading");

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.legacy.min.mjs";
        const doc = await pdfjs.getDocument({ url, withCredentials: true }).promise;
        const width = box.clientWidth || 600;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          const viewport = page.getViewport({ scale: scale * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.style.marginBottom = "8px";
          canvas.style.background = "#fff";
          canvas.setAttribute("aria-label", `${title} ${n}ページ目`);
          box.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
        }
        if (!cancelled) setState("ready");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, title]);

  return (
    <div>
      {state === "loading" && <p className="rounded-xl bg-slate-800 p-4 text-sm text-slate-400">プレビューを読み込み中...</p>}
      {state === "error" && (
        <p className="rounded-xl bg-red-950/40 p-4 text-sm text-red-300">
          プレビューを表示できませんでした（{error}）。「別タブで開く」から確認してください。
        </p>
      )}
      <div ref={boxRef} className="overflow-hidden rounded-xl" />
    </div>
  );
}
