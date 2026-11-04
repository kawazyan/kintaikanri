import { prisma } from "@/lib/prisma";
import { amountEntryOf } from "@/lib/amount-entry";
import { AmountEntryForm } from "./entry-form";

export const metadata = { title: "金額入力", robots: { index: false, follow: false } };

// 取引先ごとの専用リンク。合言葉(token)が一致しなければ、取引先名も金額も表示しない。
export default async function AmountEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clients = await prisma.client.findMany({ select: { id: true, name: true, billingTerms: true } });
  const client = clients.find((c) => amountEntryOf(c.billingTerms)?.token === token);
  if (!client) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-xl font-black">このリンクは無効です</h1>
        <p className="mt-3 text-sm text-slate-600">管理者に確認してください。</p>
      </main>
    );
  }
  // 対象月の候補: 日本時間の今月の前2か月から翌月まで。
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const months: string[] = [];
  for (let k = -2; k <= 1; k++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + k, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <p className="text-xs font-bold text-slate-500">金額入力</p>
      <h1 className="mt-1 text-xl font-black text-slate-900">{client.name}</h1>
      <p className="mt-2 text-sm text-slate-600">対象月と税抜金額を入れて送信すると、請求書がすぐ取引先へ送られます。</p>
      <div className="mt-6">
        <AmountEntryForm token={token} months={months} />
      </div>
    </main>
  );
}
