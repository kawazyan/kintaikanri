import { findPreviewInvoice } from "@/lib/amount-entry-server";
import { renderInvoicePdf } from "@/lib/invoice-render";
import { renderStatementPdf } from "@/lib/invoice-render";

// プレビュー用のPDF(請求書 or 明細書)。合言葉と取引先が一致し、未送信の請求だけ出す。
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; id: string; kind: string }> }) {
  const { token, id, kind } = await params;
  const found = await findPreviewInvoice(token, id);
  if (!found) return new Response("not found", { status: 404 });
  const rendered = kind === "statement" ? await renderStatementPdf(id) : kind === "invoice" ? await renderInvoicePdf(id) : null;
  if (!rendered) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(rendered.buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${kind}.pdf"`, "Cache-Control": "no-store" },
  });
}
