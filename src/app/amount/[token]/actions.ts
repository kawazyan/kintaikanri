"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AMOUNT_ENTRY_ITEM_LABEL, validateAmountEntry } from "@/lib/amount-entry";
import { findClientByAmountToken, findPreviewInvoice } from "@/lib/amount-entry-server";
import { computeInvoiceTotals } from "@/lib/billing";
import { buildInvoiceLines } from "@/lib/invoice-lines";
import type { StatementStaff, StatementSnapshot } from "@/lib/invoice-draft";
import { DEFAULT_INVOICE_NOTE } from "@/lib/invoice-defaults";
import { approveDraftInvoice, sendApprovedInvoice } from "@/lib/invoice-send";

export type AmountEntryResult = { ok: true; id: string } | { ok: false; error: string };
export type SendResult = { ok: true; message: string } | { ok: false; error: string };

const jstDay = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

// 1) 入力: 対象月と税抜金額で、請求書の下書き(未送信)を作る。送信はしない。
// 同じ月の未送信の下書き(この画面で作ったもの)があれば、金額と明細を入れ替える。送信済みの月は作らない。
export async function prepareAmountEntry(token: string, yearMonth: string, amountExTax: number): Promise<AmountEntryResult> {
  const invalid = validateAmountEntry(yearMonth, amountExTax);
  if (invalid) return { ok: false, error: invalid };
  const found = await findClientByAmountToken(token);
  if (!found) return { ok: false, error: "このリンクは無効です。管理者に確認してください。" };
  const { client, entry } = found;

  const existing = await prisma.invoice.findMany({
    where: { clientId: client.id, yearMonth, kind: "WORK", branch: null },
    select: { id: true, status: true, sentAt: true, revision: true, statement: true },
  });
  if (existing.some((i) => i.sentAt)) {
    return { ok: false, error: `${yearMonth.replace("-", "年")}月分は、すでに送信済みです。金額を直す必要があれば、管理者に連絡してください。` };
  }

  // 明細書の稼働日: 設定のスタッフの、対象月のシフト(取消を除く)。店舗は日ごとのシフトの店舗を使う。
  const [y, mo] = yearMonth.split("-").map(Number);
  const start = new Date(`${yearMonth}-01T00:00:00+09:00`);
  const end = new Date(`${new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7)}-01T00:00:00+09:00`);
  const staff = entry.staffId ? await prisma.staff.findUnique({ where: { id: entry.staffId }, select: { name: true } }) : null;
  const shifts = entry.staffId
    ? await prisma.shift.findMany({ where: { staffId: entry.staffId, cancelledAt: null, startTime: { gte: start, lt: end } }, select: { startTime: true, storeName: true }, orderBy: { startTime: "asc" } })
    : [];
  const dayPlaces: Record<string, string> = {};
  for (const s of shifts) dayPlaces[jstDay(s.startTime)] = s.storeName;
  const dates = Object.keys(dayPlaces).sort();
  const staffRow: StatementStaff = {
    name: staff?.name ?? "（稼働者）",
    places: [...new Set(Object.values(dayPlaces))],
    carriers: entry.carrier ? [entry.carrier] : [],
    dates,
    dayPlaces,
    days: dates.length,
    serviceExTax: amountExTax,
    serviceCalc: `手入力 ¥${amountExTax.toLocaleString("ja-JP")}`,
    travel: { mode: "NONE", amountExTax: 0, amountInclTax: 0 },
  };

  const statement: StatementSnapshot = {
    clientName: client.name,
    yearMonth,
    staff: entry.staffId ? [staffRow] : [],
    clientExtras: [],
    manualLines: [{ label: AMOUNT_ENTRY_ITEM_LABEL, quantity: 1, unitPriceExTax: amountExTax }],
    manualTaxMode: "EX",
    manualShowAttendance: true,
  };
  const lines = buildInvoiceLines(statement, false);
  const totals = computeInvoiceTotals(lines);
  const subject = `${y}年${mo}月請求に関して`;

  const unsent = existing.find((i) => (i.status === "DRAFT" || i.status === "APPROVED") && (i.statement as unknown as StatementSnapshot | null)?.manualLines?.[0]?.label === AMOUNT_ENTRY_ITEM_LABEL);
  if (unsent) {
    await prisma.$transaction([
      prisma.invoice.update({ where: { id: unsent.id }, data: { ...totals, statement: statement as object, status: "DRAFT", approvedAt: null, approvedBy: null, subject, note: DEFAULT_INVOICE_NOTE } }),
      prisma.invoiceLine.deleteMany({ where: { invoiceId: unsent.id } }),
      prisma.invoiceLine.createMany({ data: lines.map((l) => ({ ...l, invoiceId: unsent.id })) }),
    ]);
    return { ok: true, id: unsent.id };
  }
  const revision = (existing.reduce((m, i) => Math.max(m, i.revision), 0)) + 1;
  const created = await prisma.invoice.create({
    data: {
      clientId: client.id,
      yearMonth,
      invoiceNumber: `KJ-${yearMonth.replace("-", "")}-${String(Date.now()).slice(-6)}${revision > 1 ? `-R${revision}` : ""}`,
      revision,
      kind: "WORK",
      ...totals,
      statement: statement as object,
      subject,
      note: DEFAULT_INVOICE_NOTE,
      lines: { create: lines },
    },
  });
  return { ok: true, id: created.id };
}

// 2) 送信: プレビューで確認した請求を、承認して、すぐ送信する。
export async function sendPreparedInvoice(token: string, invoiceId: string): Promise<SendResult> {
  const found = await findPreviewInvoice(token, invoiceId);
  if (!found) return { ok: false, error: "この請求は送信できません。最初の画面からやり直してください。" };
  try {
    if (found.invoice.status === "DRAFT") await approveDraftInvoice(invoiceId, found.entry.approverName);
    await sendApprovedInvoice(invoiceId);
    revalidatePath("/admin/invoices");
    return { ok: true, message: `${found.invoice.yearMonth.replace("-", "年")}月分の請求書と明細書を送信しました。` };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "送信に失敗しました。";
    return { ok: false, error: `送信できませんでした。請求書は下書きとして残っています。管理者に連絡してください。（${reason}）` };
  }
}
