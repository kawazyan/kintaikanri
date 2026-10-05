"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInvoiceDraft, statementBillableExTax, type StatementSnapshot } from "@/lib/invoice-draft";
import { approveDraftInvoice, sendApprovedInvoice } from "@/lib/invoice-send";
import { addTax, computeInvoiceTotals, splitInclusiveTax } from "@/lib/billing";

export type CreateDraftResult = { ok: true; id: string } | { ok: false; error: string };

// 下書き作成。業務上のエラー(承認済みの稼働依頼がない等)は画面に例外を投げず、メッセージで返す。
export async function createInvoiceDraft(formData: FormData): Promise<CreateDraftResult> {
  await requireAdmin();
  const clientId = String(formData.get("clientId") || "");
  const yearMonth = String(formData.get("yearMonth") || "");
  try {
    const { id } = await buildInvoiceDraft(clientId, yearMonth);
    revalidatePath("/admin/invoices");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "請求下書きを作成できませんでした。" };
  }
}

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

// 「承認」: 下書き → 承認済み(メールは送らない)。
export async function approveInvoice(id: string, approverName: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await approveDraftInvoice(id, approverName);
    revalidatePath(`/admin/invoices/${id}`);
    revalidatePath("/admin/invoices");
    return { ok: true, message: "承認しました。承認済みの一覧から送信できます。" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "承認に失敗しました。" };
  }
}

// 「送信」: 承認済み → 送付済み(取引先へメール送信。管理者CC)。
export async function sendInvoice(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { to, cc } = await sendApprovedInvoice(id);
    revalidatePath(`/admin/invoices/${id}`);
    revalidatePath("/admin/invoices");
    return { ok: true, message: `送信しました（宛先: ${to.join(", ")}${cc.length ? ` / CC: ${cc.join(", ")}` : ""}）` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "送信に失敗しました。" };
  }
}

// 「削除」: 下書き・承認済みのみ。送付済みは削除できない(記録を残すため)。
export async function deleteInvoice(id: string): Promise<ActionResult> {
  await requireAdmin();
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true } });
  if (!invoice) return { ok: false, error: "請求書が見つかりません。" };
  if (invoice.status !== "DRAFT" && invoice.status !== "APPROVED") return { ok: false, error: "送付済みの請求は削除できません。" };
  await prisma.invoice.delete({ where: { id } });
  revalidatePath("/admin/invoices");
  return { ok: true, message: "削除しました。" };
}

export type InvoiceEditPayload = {
  addressee: string;
  subject: string;
  note: string;
  // 稼働明細書(スタッフの並びは作成時のまま)。請求書は「業務委託費一式」1行のみで、金額は明細書の合計から自動計算する。
  // dayPlaces: 稼働日(YYYY-MM-DD) → その日の稼働場所。変更した日は、シフトと打刻履歴の店舗名にも反映する。
  staff: { dates: string[]; dayPlaces?: Record<string, string>; serviceExTax: number; serviceCalc: string; travelInclTax: number }[];
  // 取引先全体の項目(新幹線代・広告原価・商材仕入れ代原価など)。金額は税抜。
  clientExtras: { label: string; amountExTax: number; calc?: string; store?: string; period?: string }[];
  // 明細書データがない古い請求だけ使う(業務委託費一式の税抜金額)。
  amountExTax?: number;
};

// 「修正」画面の保存。請求書は税率(10%固定)と発行日(稼働月の月末日に自動)以外を直せる。
// 請求書の品目は「業務委託費一式」のみ。内訳(計算方法・交通費など)は稼働明細書で直す。
// approveAfter=true(下書きのみ)のときは、保存後にそのまま承認まで行う。メール送信は別操作。
export async function saveInvoiceEdit(
  id: string,
  payload: InvoiceEditPayload,
  approveAfter: boolean,
  approverName: string
): Promise<ActionResult> {
  await requireAdmin();
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true, yearMonth: true, statement: true } });
  if (!invoice) return { ok: false, error: "請求書が見つかりません。" };
  if (invoice.status !== "DRAFT" && invoice.status !== "APPROVED") return { ok: false, error: "送付済みの請求は修正できません。" };

  const addressee = payload.addressee.trim();
  const subject = payload.subject.trim();
  if (!addressee) return { ok: false, error: "宛名を入力してください。" };
  if (!subject) return { ok: false, error: "件名を入力してください。" };

  const snapshot = invoice.statement as unknown as StatementSnapshot | null;
  let nextStatement: StatementSnapshot | undefined;
  let unitPrice: number;
  // 稼働場所を変更した日のシフト・打刻履歴の更新(請求書の保存と同じトランザクションで実行する)
  const placeSyncOps: Prisma.PrismaPromise<unknown>[] = [];
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
      const svc = payload.staff[i].serviceExTax;
      if (!Number.isInteger(svc) || svc < 0) return { ok: false, error: `${snapshot.staff[i].name}さんの業務委託費（税抜）は0以上の整数で入力してください。` };
      datesByStaff.push(dates);
    }
    const clientExtras: StatementSnapshot["clientExtras"] = [];
    for (const e of payload.clientExtras ?? []) {
      const label = e.label.trim();
      if (!label && !e.amountExTax) continue; // 空行は無視
      if (!label) return { ok: false, error: "共通の項目に、名前のない行があります。名前を入力するか、行を削除してください。" };
      if (!Number.isInteger(e.amountExTax) || e.amountExTax < 0) return { ok: false, error: `共通の項目「${label}」の金額（税抜）は0以上の整数で入力してください。` };
      clientExtras.push({ label, amountExTax: e.amountExTax, amountInclTax: addTax(e.amountExTax).amountIncl, ...(e.calc?.trim() ? { calc: e.calc.trim() } : {}), ...(e.store?.trim() && e.period?.trim() ? { store: e.store.trim(), period: e.period.trim() } : {}) });
    }
    // 稼働場所: 稼働日ごとに整える。空欄の日は「稼働店舗 要確認」と表示される(元の値は残さない)。
    const dayPlacesByStaff: Record<string, string>[] = snapshot.staff.map((st, i) => {
      const input = payload.staff[i].dayPlaces ?? st.dayPlaces ?? {};
      return Object.fromEntries(datesByStaff[i].flatMap((d) => (input[d]?.trim() ? [[d, input[d].trim()]] : [])));
    });
    for (let i = 0; i < snapshot.staff.length; i++) {
      const st = snapshot.staff[i];
      const changed = Object.entries(dayPlacesByStaff[i]).filter(([d, place]) => (st.dayPlaces?.[d] ?? "") !== place);
      if (!changed.length) continue;
      const people = await prisma.staff.findMany({ where: { name: st.name }, select: { id: true } });
      if (people.length !== 1) return { ok: false, error: `${st.name}さんを社内スタッフから特定できないため、稼働場所をシフトへ反映できません。` };
      for (const [d, place] of changed) {
        const dayStart = new Date(`${d}T00:00:00+09:00`);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const shiftWhere = { staffId: people[0].id, cancelledAt: null, startTime: { gte: dayStart, lt: dayEnd } };
        placeSyncOps.push(prisma.clockRecord.updateMany({ where: { shift: shiftWhere }, data: { storeName: place } }));
        placeSyncOps.push(prisma.shift.updateMany({ where: shiftWhere, data: { storeName: place } }));
      }
    }
    nextStatement = {
      ...snapshot,
      clientExtras,
      staff: snapshot.staff.map((st, i) => {
        const dates = datesByStaff[i];
        const dayPlaces = dayPlacesByStaff[i];
        const raw = payload.staff[i].travelInclTax;
        const incl = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
        const ex = incl > 0 ? splitInclusiveTax(incl).amountEx : 0;
        const mode: StatementSnapshot["staff"][number]["travel"]["mode"] =
          incl === 0 ? "NONE" : st.travel.mode === "NONE" ? "ACTUAL" : st.travel.mode;
        return {
          ...st,
          dates,
          dayPlaces,
          places: Object.keys(dayPlaces).length ? [...new Set(dates.map((d) => dayPlaces[d]).filter(Boolean))] : st.places,
          days: dates.length,
          serviceExTax: payload.staff[i].serviceExTax,
          serviceCalc: payload.staff[i].serviceCalc.trim() || st.serviceCalc,
          travel: {
            mode,
            amountExTax: ex,
            amountInclTax: incl,
            ...(st.travel.calc && st.travel.amountInclTax === incl ? { calc: st.travel.calc } : {}),
            ...(st.travel.lines?.length && st.travel.amountInclTax === incl ? { lines: st.travel.lines } : {}),
          },
        };
      }),
    };
    unitPrice = statementBillableExTax(nextStatement);
  } else {
    const v = payload.amountExTax;
    if (v == null || !Number.isInteger(v) || v < 0) return { ok: false, error: "業務委託費一式の金額（税抜）は0以上の整数で入力してください。" };
    unitPrice = v;
  }

  const line = { quantity: 1, unitPriceExTax: unitPrice };
  const totals = computeInvoiceTotals([line]);
  const t = addTax(unitPrice);
  await prisma.$transaction([
    ...placeSyncOps,
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
    prisma.invoiceLine.create({
      data: {
        invoiceId: id,
        sortOrder: 10,
        itemType: "SERVICE",
        label: "業務委託費一式",
        description: "内訳は別紙「稼働明細書」のとおり",
        unitPriceExTax: unitPrice,
        quantity: 1,
        subtotalExTax: unitPrice,
        taxAmount: t.tax,
        totalInclTax: t.amountIncl,
      },
    }),
  ]);
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath("/admin/invoices");

  if (!approveAfter || invoice.status !== "DRAFT") return { ok: true, message: "修正を保存しました。" };
  return approveInvoice(id, approverName);
}
