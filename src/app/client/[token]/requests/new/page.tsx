import Link from "next/link";

// 稼働依頼の受付は終了した(契約条件は管理者が取引先の契約として登録する運用)。過去の依頼の確認は、依頼ごとのURLからできる。
export default async function NewRequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="min-h-dvh bg-[#f4f5f7] text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link href={`/client/${token}`} className="text-sm font-bold text-slate-500">← 戻る</Link>
        <h1 className="mt-3 text-2xl font-black">稼働依頼の受付は終了しました</h1>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-600">稼働のご依頼は、株式会社K.Jの担当者へ直接ご連絡ください。</p>
      </div>
    </main>
  );
}
