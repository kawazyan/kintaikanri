import { isAdmin } from "@/lib/auth";
import { renderInvoicePdf, renderStatementPdf } from "@/lib/invoice-render";
import { mergePdfs } from "@/lib/pdf-bundle";

export const runtime = "nodejs";

// 請求書 → 請求内訳書 の順に1つにまとめたPDF。管理者のみ。
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const inv = await renderInvoicePdf(id);
  const stmt = await renderStatementPdf(id);
  if (!inv) return new Response("Not Found", { status: 404 });
  if (!stmt) return new Response("この請求には請求内訳書のデータがありません。請求下書きを作り直してください。", { status: 404 });
  const merged = await mergePdfs([inv.buffer, stmt.buffer]);
  return new Response(new Uint8Array(merged), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-and-statement-${inv.invoice.invoiceNumber}.pdf"`,
    },
  });
}
