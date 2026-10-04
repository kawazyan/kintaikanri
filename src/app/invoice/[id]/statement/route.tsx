import { renderToBuffer } from "@react-pdf/renderer";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { StatementSnapshot } from "@/lib/invoice-draft";
import { StatementDocument } from "./statement-document";

export const runtime = "nodejs";

// 稼働明細書PDF。請求書とは別ファイル。管理者のみ(請求下書きの段階でも確認できる)。
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { invoiceNumber: true, statement: true } });
  if (!invoice) return new Response("Not Found", { status: 404 });
  if (!invoice.statement) {
    return new Response("この請求には稼働明細書のデータがありません（新機能の追加前に作成された請求です）。請求下書きを作り直してください。", { status: 404 });
  }

  const buffer = await renderToBuffer(<StatementDocument data={invoice.statement as unknown as StatementSnapshot} />);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="statement-${invoice.invoiceNumber}.pdf"`,
    },
  });
}
