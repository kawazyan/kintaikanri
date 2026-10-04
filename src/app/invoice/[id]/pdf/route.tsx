import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdf } from "@/lib/invoice-render";

export const runtime = "nodejs";

// 請求書PDF。送付済みの請求は従来どおり開ける。下書き・承認済みは管理者のみ(送付前のプレビュー用)。
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const head = await prisma.invoice.findUnique({ where: { id }, select: { status: true } });
  if (!head) return new Response("Not Found", { status: 404 });
  if ((head.status === "DRAFT" || head.status === "APPROVED") && !(await isAdmin())) return new Response("Unauthorized", { status: 401 });

  const out = await renderInvoicePdf(id);
  if (!out) return new Response("Not Found", { status: 404 });
  return new Response(new Uint8Array(out.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${out.invoice.invoiceNumber}.pdf"`,
    },
  });
}
