import { prisma } from "@/lib/prisma";
import { amountEntryOf, AMOUNT_ENTRY_ITEM_LABEL } from "@/lib/amount-entry";
import type { StatementSnapshot } from "@/lib/invoice-draft";

// 合言葉から取引先と、その取引先の「金額入力で作った未送信の請求」を探す。見つからなければ null。
// 送信済みの請求や、ほかの取引先の請求は対象にしない。
export async function findClientByAmountToken(token: string) {
  const clients = await prisma.client.findMany({ select: { id: true, name: true, billingTerms: true } });
  const client = clients.find((c) => amountEntryOf(c.billingTerms)?.token === token);
  if (!client) return null;
  const entry = amountEntryOf(client.billingTerms);
  return entry ? { client, entry } : null;
}

export async function findPreviewInvoice(token: string, invoiceId: string) {
  const found = await findClientByAmountToken(token);
  if (!found) return null;
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, clientId: true, kind: true, branch: true, status: true, sentAt: true, yearMonth: true, statement: true, subtotalExTax: true, taxAmount: true, totalInclTax: true, invoiceNumber: true, subject: true },
  });
  if (!invoice || invoice.clientId !== found.client.id || invoice.sentAt) return null;
  if (invoice.kind !== "WORK" || invoice.branch) return null;
  if (invoice.status !== "DRAFT" && invoice.status !== "APPROVED") return null;
  const label = (invoice.statement as unknown as StatementSnapshot | null)?.manualLines?.[0]?.label;
  if (label !== AMOUNT_ENTRY_ITEM_LABEL) return null;
  return { ...found, invoice };
}
