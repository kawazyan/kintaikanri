import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "../admin-nav";
import { TestMailButton } from "./button";

export default async function Page() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <AdminNav />
      <h1 className="text-2xl font-black">メール送信テスト</h1>
      <p className="mt-1 text-sm text-slate-500">
        t090070t@yahoo.co.jp にテストメールを1通送ります。請求データには影響しません。
      </p>
      <TestMailButton />
    </main>
  );
}
