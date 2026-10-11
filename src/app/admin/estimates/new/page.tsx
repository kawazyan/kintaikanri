import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toJstDateValue } from "@/lib/time";
import { invoiceRecipients } from "@/lib/invoice-defaults";
import { DEFAULT_ESTIMATE_SUBJECT } from "@/lib/estimate";
import { AdminNav } from "../../admin-nav";
import { EstimateForm } from "../estimate-form";

export default async function NewEstimatePage() {
  await requireAdmin();
  const [clients, admins] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.adminEmail.findMany({ select: { email: true } }),
  ]);
  const cc = admins.length ? `（CC: ${admins.map((a) => a.email).join(", ")}）` : "";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-slate-100">
      <AdminNav />
      <Link href="/admin/estimates" className="text-sm text-blue-400 underline">← 見積書の一覧へ戻る</Link>
      <h1 className="mt-3 text-2xl font-black">見積書を作成</h1>
      <p className="mt-1 text-sm text-slate-400">見積番号は「KJ-見積-年月-連番」で自動で付きます。入力は全て任意で、空のままでも保存できます。</p>
      <EstimateForm
        clients={clients.map((c) => ({ id: c.id, name: c.name, emails: invoiceRecipients(c), cc }))}
        initial={{
          clientId: "",
          issuedDate: toJstDateValue(new Date()),
          addressee: "",
          storeName: "",
          recipientEmails: "",
          subject: DEFAULT_ESTIMATE_SUBJECT,
          note: "",
          taxMode: "EX",
          lines: [],
        }}
      />
    </main>
  );
}
