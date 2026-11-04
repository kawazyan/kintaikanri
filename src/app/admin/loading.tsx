import { AdminNav } from "./admin-nav";

// 管理画面のどのページでも、遷移を押したらすぐ表示される「読み込み中」の画面。
// メニューは残したままにするので、押した直後に選んでいる項目が切り替わり、画面が動かないように見えない。
// 中身(データ)が届いたら、それぞれのページに置き換わる。
export default function AdminLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <AdminNav />
      <h1 className="kj-page-title">読み込み中…</h1>
      <div className="space-y-3" aria-hidden="true">
        {[0, 1, 2, 3].map((k) => (
          <div key={k} className="h-14 animate-pulse rounded-2xl bg-slate-200/70" />
        ))}
      </div>
      <p className="sr-only" role="status">読み込み中です</p>
    </main>
  );
}
