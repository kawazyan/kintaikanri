import fs from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { InvoiceDocument } from "./invoice-document";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice || invoice.status === "DRAFT") {
    return new Response("Not Found", { status: 404 });
  }

  const letterheadPath = path.join(process.cwd(), "src/assets/invoice/letterhead.png");

  const buffer = await renderToBuffer(
    <InvoiceDocument
      data={{
        invoiceNumber: invoice.invoiceNumber,
        yearMonth: invoice.yearMonth,
        clientName: invoice.client.name,
        issuedAtLabel: invoice.finalizedAt ? formatJst(invoice.finalizedAt).slice(0, 10) : "―",
        subtotalExTax: invoice.subtotalExTax,
        taxAmount: invoice.taxAmount,
        totalInclTax: invoice.totalInclTax,
        lines: invoice.lines,
        hasLetterheadImage: fs.existsSync(letterheadPath),
      }}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    },
  });
}
