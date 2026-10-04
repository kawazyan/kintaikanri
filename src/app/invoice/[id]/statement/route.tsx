import { isAdmin } from "@/lib/auth";
import { renderStatementPdf } from "@/lib/invoice-render";

export const runtime = "nodejs";

// 稼働明細書PDF。請求書とは別ファイル。管理者のみ(請求下書きの段階でも確認できる)。
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const out = await renderStatementPdf(id);
  if (!out) {
    return new Response("この請求には稼働明細書のデータがありません（新機能の追加前に作成された請求です）。請求下書きを作り直してください。", { status: 404 });
  }
  return new Response(new Uint8Array(out.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="statement-${out.invoiceNumber}.pdf"`,
    },
  });
}
