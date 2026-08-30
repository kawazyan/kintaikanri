"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, background: "#05080b", color: "white", fontFamily: "sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 360, border: "1px solid #334155", borderRadius: 22, background: "#0c131a", padding: 24, textAlign: "center" }}>
            <h1 style={{ fontSize: 20 }}>読み込みエラー</h1>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>一時的な接続エラーの可能性があります。</p>
            <button onClick={() => reset()} style={{ width: "100%", padding: 12, borderRadius: 12, border: 0, fontWeight: 800 }}>再読み込み</button>
          </div>
        </main>
      </body>
    </html>
  );
}
