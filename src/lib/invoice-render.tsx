import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { formatJst } from "@/lib/time";
import { DEFAULT_INVOICE_NOTE, defaultSubject } from "@/lib/invoice-defaults";
import type { StatementSnapshot } from "@/lib/invoice-draft";
import { InvoiceDocument, type InvoiceDocData } from "@/app/invoice/[id]/pdf/invoice-document";
import { StatementDocument } from "@/app/invoice/[id]/statement/statement-document";

export async function loadInvoiceDoc(id: string, issuedAtOverride?: Date) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice) return null;
  const data: InvoiceDocData = {
    addressee: invoice.addressee?.trim() || invoice.client.name,
    subject: invoice.subject?.trim() || defaultSubject(invoice.yearMonth),
    issuedAtLabel: (issuedAtOverride ?? invoice.finalizedAt) ? formatJst((issuedAtOverride ?? invoice.finalizedAt)!).slice(0, 10).replaceAll("-", "/") : "",
    lines: invoice.lines.map((l) => ({
      label: l.label,
      description: l.description,
      quantity: l.quantity,
      unitPriceExTax: l.unitPriceExTax,
    })),
    subtotalExTax: invoice.subtotalExTax,
    taxAmount: invoice.taxAmount,
    totalInclTax: invoice.totalInclTax,
    note: invoice.note?.trim() ? invoice.note : DEFAULT_INVOICE_NOTE,
  };
  return { invoice, data };
}

export async function renderInvoicePdf(id: string, issuedAtOverride?: Date) {
  const loaded = await loadInvoiceDoc(id, issuedAtOverride);
  if (!loaded) return null;
  const buffer = await renderToBuffer(<InvoiceDocument data={loaded.data} />);
  return { buffer, invoice: loaded.invoice, data: loaded.data };
}

export async function renderStatementPdf(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { invoiceNumber: true, statement: true } });
  if (!invoice?.statement) return null;
  const buffer = await renderToBuffer(<StatementDocument data={invoice.statement as unknown as StatementSnapshot} />);
  return { buffer, invoiceNumber: invoice.invoiceNumber };
}
