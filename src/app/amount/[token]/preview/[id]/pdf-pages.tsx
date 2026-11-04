"use client";

import { useEffect, useRef, useState } from "react";

// 書類(PDF)を、ページごとに画面へ描く。スマホでもPDFを開かずに、管理画面と同じ見た目で確認できる。
export function PdfPages({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const container = ref.current;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
        const res = await fetch(src, { cache: "no-store" });
        if (!res.ok) throw new Error("fetch");
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await res.arrayBuffer()) }).promise;
        if (cancelled || !container) return;
        container.innerHTML = "";
        const width = container.clientWidth || 600;
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width * Math.min(window.devicePixelRatio || 1, 2)) / base.width });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.style.marginBottom = "8px";
          container.appendChild(canvas);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("canvas");
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div>
      <div ref={ref} className="rounded-xl border border-slate-200 bg-slate-100 p-2" aria-label={title} />
      {failed && <p className="mt-2 text-sm font-bold text-red-800">{title}を表示できませんでした。下の「PDFを開く」から確認してください。</p>}
    </div>
  );
}
