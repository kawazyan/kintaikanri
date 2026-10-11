import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { EstimateDocument, type EstimateDocData } from "@/app/estimate/[id]/pdf/estimate-document";

// 見積書PDFを作る。請求書(invoice-render.tsx)とは別のファイル。
export async function renderEstimatePdf(id: string) {
  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!estimate) return null;
  const data: EstimateDocData = {
    estimateNumber: estimate.estimateNumber,
    addressee: estimate.addressee,
    storeName: estimate.storeName,
    subject: estimate.subject,
    issuedAtLabel: estimate.issuedDate.replaceAll("-", "/"),
    lines: estimate.lines.map((l) => ({ label: l.label, description: l.description, quantity: l.quantity, unitPriceExTax: l.unitPriceExTax })),
    subtotalExTax: estimate.subtotalExTax,
    taxAmount: estimate.taxAmount,
    totalInclTax: estimate.totalInclTax,
    note: estimate.note,
  };
  const buffer = await renderToBuffer(<EstimateDocument data={data} />);
  return { buffer, estimate, data };
}
