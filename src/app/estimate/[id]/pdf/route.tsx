import { isAdmin } from "@/lib/auth";
import { renderEstimatePdf } from "@/lib/estimate-render";

export const runtime = "nodejs";

// 見積書PDF。管理者のみ(取引先への送付はメール添付で行う)。
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const out = await renderEstimatePdf(id);
  if (!out) return new Response("Not Found", { status: 404 });
  return new Response(new Uint8Array(out.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      // 日本語を含む見積番号はヘッダに直接入れられないため、ASCIIのファイル名にする。
      "Content-Disposition": `inline; filename="estimate-${out.estimate.id}.pdf"`,
    },
  });
}
