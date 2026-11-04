"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AMOUNT_ENTRY_ITEM_LABEL, amountEntryOf, validateAmountEntry } from "@/lib/amount-entry";
import { computeInvoiceTotals } from "@/lib/billing";
import { buildInvoiceLines } from "@/lib/invoice-lines";
import { DEFAULT_EXTRA_INVOICE_NOTE, INVOICE_KIND_EXTRA, extraInvoiceNumber, extraSubject } from "@/lib/invoice-kind";
import type { StatementSnapshot } from "@/lib/invoice-draft";
import { approveDraftInvoice, sendApprovedInvoice } from "@/lib/invoice-send";

export type AmountEntryResult = { ok: true; message: string } | { ok: false; error: string };

// 金額入力フォームの送信: 対象月と税抜金額で請求書(金額だけの請求書・内訳書なし)を作り、承認して、すぐ送信する。
// 同じ月に送信済みの請求があれば送らない。未送信の下書きがあれば、その金額を入れ替える(二重に作らない)。
export async function submitAmountEntry(token: string, yearMonth: string, amountExTax: number): Promise<AmountEntryResult> {
  const invalid = validateAmountEntry(yearMonth, amountExTax);
  if (invalid) return { ok: false, error: invalid };

  const clients = await prisma.client.findMany({ select: { id: true, name: true, billingTerms: true } });
  const client = clients.find((c) => amountEntryOf(c.billingTerms)?.token === token);
  if (!client) return { ok: false, error: "このリンクは無効です。管理者に確認してください。" };
  const entry = amountEntryOf(client.billingTerms);
  if (!entry) return { ok: false, error: "このリンクは無効です。管理者に確認してください。" };

  const sameMonth = (await prisma.invoice.findMany({
    where: { clientId: client.id, yearMonth, kind: INVOICE_KIND_EXTRA },
    select: { id: true, status: true, sentAt: true, statement: true },
  })).filter((i) => (i.statement as unknown as StatementSnapshot | null)?.manualLines?.[0]?.label === AMOUNT_ENTRY_ITEM_LABEL);

  if (sameMonth.some((i) => i.sentAt)) {
    return { ok: false, error: `${yearMonth.replace("-", "年")}月分は、すでに送信済みです。金額を直す必要があれば、管理者に連絡してください。` };
  }

  const statement: StatementSnapshot = {
    clientName: client.name,
    yearMonth,
    staff: [],
    clientExtras: [],
    manualLines: [{ label: AMOUNT_ENTRY_ITEM_LABEL, quantity: 1, unitPriceExTax: amountExTax }],
    manualTaxMode: "EX",
    manualShowAttendance: false,
  };
  const lines = buildInvoiceLines(statement, false);
  const totals = computeInvoiceTotals(lines);

  const unsent = sameMonth.find((i) => i.status === "DRAFT" || i.status === "APPROVED");
  let id: string;
  if (unsent) {
    id = unsent.id;
    await prisma.$transaction([
      prisma.invoice.update({ where: { id }, data: { ...totals, statement: statement as object, status: "DRAFT", approvedAt: null, approvedBy: null } }),
      prisma.invoiceLine.deleteMany({ where: { invoiceId: id } }),
      prisma.invoiceLine.createMany({ data: lines.map((l) => ({ ...l, invoiceId: id })) }),
    ]);
  } else {
    const created = await prisma.invoice.create({
      data: {
        clientId: client.id,
        yearMonth,
        invoiceNumber: extraInvoiceNumber(yearMonth),
        revision: 1,
        kind: INVOICE_KIND_EXTRA,
        ...totals,
        statement: statement as object,
        subject: extraSubject(yearMonth, AMOUNT_ENTRY_ITEM_LABEL),
        note: DEFAULT_EXTRA_INVOICE_NOTE,
        lines: { create: lines },
      },
    });
    id = created.id;
  }

  try {
    await approveDraftInvoice(id, entry.approverName);
    await sendApprovedInvoice(id);
    revalidatePath("/admin/invoices");
    return { ok: true, message: `${yearMonth.replace("-", "年")}月分（税抜 ${amountExTax.toLocaleString("ja-JP")}円）の請求書を送信しました。` };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "送信に失敗しました。";
    return { ok: false, error: `送信できませんでした。請求書は下書きとして残っています。管理者に連絡してください。（${reason}）` };
  }
}
