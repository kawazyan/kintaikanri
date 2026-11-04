import { prisma } from "@/lib/prisma";
import { computeInvoiceTotals } from "@/lib/billing";
import type { BillingTerms } from "@/lib/billing-terms";
import { buildInvoiceLines } from "@/lib/invoice-lines";
import type { StatementSnapshot } from "@/lib/invoice-draft";
import { invoiceFamilyBase, isExtraInvoice } from "@/lib/invoice-kind";

// 送付済み(確定・再発行)の請求から、訂正版(次の版・下書き)を作る。
// - 送付済みの請求は変更しない。
// - 一番新しい版だけ訂正できる。すでに新しい版(下書き・承認済みなど)があれば、そちらを直す。
// - 宛名・件名・備考、稼働明細書、取引先・稼働依頼の紐付けをそのまま引き継ぐ。
//   品目は取引先の現在の設定(品目を分けて表示するか)で作り直す。注意メッセージは引き継がない。
export async function createCorrectionDraft(id: string) {
  const src = await prisma.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } }, workOrders: true, client: { select: { billingTerms: true } } },
  });
  if (!src) throw new Error("請求書が見つかりません。");
  if (src.status !== "FINALIZED" && src.status !== "REISSUED") throw new Error("送付済みの請求だけ、訂正版を作れます。");

  // 版は、同じ種類の請求の中で数える。別途請求は、同じ請求番号の系列(-R2 など)だけを見る(同じ月に別の別途請求があっても影響しない)。
  const extra = isExtraInvoice(src.kind);
  const base = invoiceFamilyBase(src.invoiceNumber);
  const newer = await prisma.invoice.findFirst({
    where: {
      clientId: src.clientId,
      yearMonth: src.yearMonth,
      kind: src.kind,
      branch: src.branch, // 店舗ごとの請求は、同じ店舗だけで版を数える
      revision: { gt: src.revision },
      ...(extra ? { invoiceNumber: { startsWith: base } } : {}),
    },
    orderBy: { revision: "desc" },
    select: { invoiceNumber: true },
  });
  if (newer) throw new Error(`この請求にはすでに新しい版（${newer.invoiceNumber}）があります。そちらを直すか、不要なら削除してから作り直してください。`);

  const statement = src.statement ? (JSON.parse(JSON.stringify(src.statement)) as StatementSnapshot) : null;
  if (statement) statement.warnings = [];
  const split = !!((src.client.billingTerms ?? {}) as BillingTerms).splitInvoiceLines;
  const lines = statement
    ? buildInvoiceLines(statement, split)
    : src.lines.map((l) => ({ sortOrder: l.sortOrder, itemType: l.itemType, label: l.label, description: l.description, unitPriceExTax: l.unitPriceExTax, quantity: l.quantity, subtotalExTax: l.subtotalExTax, taxAmount: l.taxAmount, totalInclTax: l.totalInclTax }));
  const totals = computeInvoiceTotals(lines);

  const revision = src.revision + 1;
  const invoiceNumber = extra ? `${base}-R${revision}` : `KJ-${src.yearMonth.replace("-", "")}-${Date.now().toString().slice(-6)}-R${revision}`;
  const created = await prisma.invoice.create({
    data: {
      clientId: src.clientId,
      yearMonth: src.yearMonth,
      invoiceNumber,
      revision,
      kind: src.kind,
      branch: src.branch,
      ...totals,
      ...(statement ? { statement: statement as object } : {}),
      addressee: src.addressee,
      recipientEmails: src.recipientEmails,
      dueDate: src.dueDate,
      subject: src.subject,
      note: src.note,
      lines: { create: lines },
      workOrders: { create: src.workOrders.map((w) => ({ workOrderId: w.workOrderId })) },
    },
  });
  return { id: created.id, invoiceNumber };
}
