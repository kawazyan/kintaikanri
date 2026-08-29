import { ClientRequestForm } from "./request-form";

export default function ClientEntryPage() {
  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#edf1f4_0%,#f8fafb_36%,#eef2f5_100%)] text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <header className="mb-7 rounded-[30px] bg-[#14283b] px-6 py-7 text-white shadow-[0_18px_50px_rgba(20,40,59,.22)]">
          <p className="text-[11px] font-black tracking-[.24em] text-slate-300">K.J BUSINESS REQUEST</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">稼働依頼フォーム</h1>
          <p className="mt-3 max-w-xl text-sm font-bold leading-6 text-slate-300">取引先様専用の依頼ページです。事前の取引先登録は不要です。必要事項をご入力いただくと、K.J管理画面へ承認待ちとして届きます。</p>
        </header>
        <ClientRequestForm />
      </div>
    </main>
  );
}
