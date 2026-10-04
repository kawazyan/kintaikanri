"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInvoiceDraft, type StatementSnapshot } from "@/lib/invoice-draft";
import { approveAndSendInvoice } from "@/lib/invoice-send";
import { addTax, computeInvoiceTotals, splitInclusiveTax } from "@/lib/billing";

export async function createInvoiceDraft(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId") || "");
  const yearMonth = String(formData.get("yearMonth") || "");
  const { id } = await buildInvoiceDraft(clientId, yearMonth);
  revalidatePath("/admin/invoices");
  return id;
}

export async function finalizeInvoice(id: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("finalizedBy") || "").trim();
  if (!name) throw new Error("請求確定者名は必須です。");
  const current = await prisma.invoice.findUnique({ where: { id }, select: { revision: true } });
  if (!current) throw new Error("請求書が見つかりません。");
  await prisma.invoice.update({
    where: { id },
    data: { status: current.revision > 1 ? "REISSUED" : "FINALIZED", finalizedAt: new Date(), finalizedBy: name },
  });
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath("/admin/invoices");
}

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

// 「承認」: 請求書PDF・稼働明細書PDFを取引先の登録メールへ送信し(管理者CC)、送信できたら確定する。
export async function approveInvoice(id: string, approverName: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { to, cc } = await approveAndSendInvoice(id, approverName);
    revalidatePath(`/admin/invoices/${id}`);
    revalidatePath("/admin/invoices");
    return { ok: true, message: `送信しました（宛先: ${to.join(", ")}${cc.length ? ` / CC: ${cc.join(", ")}` : ""}）` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "送信に失敗しました。" };
  }
}

export type InvoiceEditPayload = {
  addressee: string;
  subject: string;
  note: string;
  lines: { label: string; description: string; quantity: number; unitPriceExTax: number }[];
  // 稼働明細書(スタッフの並びは作成時のまま)。稼働日と交通費(税込)を直せる。
  staff: { dates: string[]; travelInclTax: number }[];
};

// 「修正」画面の保存。請求書は税率(10%固定)と発行日(承認日に自動)以外を直せる。
// sendAfter=true のときは保存後にそのまま承認(PDF送信)まで行う。
export async function saveInvoiceEdit(
  id: string,
  payload: InvoiceEditPayload,
  sendAfter: boolean,
  approverName: string
): Promise<ActionResult> {
  await requireAdmin();
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true, yearMonth: true, statement: true } });
  if (!invoice) return { ok: false, error: "請求書が見つかりません。" };
  if (invoice.status !== "DRAFT") return { ok: false, error: "確定・送信済みの請求は修正できません。" };

  const addressee = payload.addressee.trim();
  const subject = payload.subject.trim();
  if (!addressee) return { ok: false, error: "宛名を入力してください。" };
  if (!subject) return { ok: false, error: "件名を入力してください。" };

  const lines = payload.lines
    .map((l) => ({ ...l, label: l.label.trim(), description: l.description.trim() }))
    .filter((l) => l.label !== "");
  if (!lines.length) return { ok: false, error: "明細行を1行以上入力してください。" };
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1) return { ok: false, error: `「${l.label}」の数量は1以上の整数にしてください。` };
    if (!Number.isInteger(l.unitPriceExTax)) return { ok: false, error: `「${l.label}」の単価は整数（税抜）で入力してください。` };
  }

  const snapshot = invoice.statement as unknown as StatementSnapshot | null;
  let nextStatement: StatementSnapshot | undefined;
  if (snapshot) {
    if (payload.staff.length !== snapshot.staff.length) return { ok: false, error: "稼働明細書のスタッフ数が一致しません。画面を開き直してください。" };
    const datesByStaff: string[][] = [];
    for (let i = 0; i < snapshot.staff.length; i++) {
      const dates = [...new Set(payload.staff[i].dates.map((d) => d.trim()).filter(Boolean))].sort();
      for (const d of dates) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !d.startsWith(`${invoice.yearMonth}-`)) {
          return { ok: false, error: `${snapshot.staff[i].name}さんの稼働日「${d}」は、対象月（${invoice.yearMonth}）の日付で入力してください。` };
        }
      }
      datesByStaff.push(dates);
    }
    nextStatement = {
      ...snapshot,
      staff: snapshot.staff.map((st, i) => {
        const dates = datesByStaff[i];
        const raw = payload.staff[i].travelInclTax;
        const incl = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
        const ex = incl > 0 ? splitInclusiveTax(incl).amountEx : 0;
        const mode: StatementSnapshot["staff"][number]["travel"]["mode"] =
          incl === 0 ? "NONE" : st.travel.mode === "NONE" ? "ACTUAL" : st.travel.mode;
        return { ...st, dates, days: dates.length, travel: { mode, amountExTax: ex, amountInclTax: incl } };
      }),
    };
  }

  const totals = computeInvoiceTotals(lines);
  await prisma.$transaction([
    prisma.invoice.update({
      where: { id },
      data: {
        addressee,
        subject,
        note: payload.note,
        subtotalExTax: totals.subtotalExTax,
        taxAmount: totals.taxAmount,
        totalInclTax: totals.totalInclTax,
        ...(nextStatement ? { statement: nextStatement } : {}),
      },
    }),
    prisma.invoiceLine.deleteMany({ where: { invoiceId: id } }),
    prisma.invoiceLine.createMany({
      data: lines.map((l, i) => {
        const sub = l.quantity * l.unitPriceExTax;
        const t = addTax(sub);
        return {
          invoiceId: id,
          sortOrder: (i + 1) * 10,
          itemType: "CUSTOM",
          label: l.label,
          description: l.description || null,
          unitPriceExTax: l.unitPriceExTax,
          quantity: l.quantity,
          subtotalExTax: sub,
          taxAmount: t.tax,
          totalInclTax: t.amountIncl,
        };
      }),
    }),
  ]);
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath("/admin/invoices");

  if (!sendAfter) return { ok: true, message: "修正を保存しました。" };
  return approveInvoice(id, approverName);
}
