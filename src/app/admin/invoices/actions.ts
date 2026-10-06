"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInvoiceDraft, computeManualStaff, statementBillableExTax, type StatementSnapshot } from "@/lib/invoice-draft";
import { normName, otherClientContracts, type BillingTerms } from "@/lib/billing-terms";
import { buildInvoiceLines } from "@/lib/invoice-lines";
import { createCorrectionDraft } from "@/lib/invoice-correction";
import { approveDraftInvoice, sendApprovedInvoice } from "@/lib/invoice-send";
import { addTax, computeInvoiceTotals, splitInclusiveTax } from "@/lib/billing";

export type CreateDraftResult = { ok: true; id: string } | { ok: false; error: string };

// 下書き作成。業務上のエラー(承認済みの稼働依頼がない等)は画面に例外を投げず、メッセージで返す。
export async function createInvoiceDraft(formData: FormData): Promise<CreateDraftResult> {
  await requireAdmin();
  const clientId = String(formData.get("clientId") || "");
  const yearMonth = String(formData.get("yearMonth") || "");
  try {
    const { id } = await buildInvoiceDraft(clientId, yearMonth, { carryOver: formData.get("carryOver") === "on" });
    revalidatePath("/admin/invoices");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "請求下書きを作成できませんでした。" };
  }
}

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

// 請求書(下書き)の画面から、契約にいないスタッフを追加する。承認すると、この内容が取引先の契約に自動登録される。
// 請求書に書いた内容が正。月額は欠勤控除する前の税抜額。掛け持ちは可。他の取引先の契約と同じ店舗で重なる場合は追加しない。
export async function addStaffToDraft(
  id: string,
  input: { staffId: string; storeName: string; rateExTax: number; absenceDeduction: "YES" | "NO" }
): Promise<ActionResult> {
  await requireAdmin();
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true, clientId: true, yearMonth: true, statement: true } });
  if (!invoice) return { ok: false, error: "請求書が見つかりません。" };
  if (invoice.status !== "DRAFT") return { ok: false, error: "スタッフを追加できるのは下書きの請求だけです。" };
  const snapshot = invoice.statement as unknown as StatementSnapshot | null;
  if (!snapshot) return { ok: false, error: "稼働明細書のデータがありません。請求下書きを作り直してください。" };

  const storeName = input.storeName.trim();
  if (!storeName) return { ok: false, error: "店舗名を入力してください。" };
  if (!Number.isInteger(input.rateExTax) || input.rateExTax <= 0) return { ok: false, error: "月額（税抜）は1以上の整数で入力してください。" };
  if (input.absenceDeduction !== "YES" && input.absenceDeduction !== "NO") return { ok: false, error: "欠勤控除の有無を選んでください。" };

  const person = await prisma.staff.findUnique({ where: { id: input.staffId }, select: { name: true } });
  if (!person) return { ok: false, error: "スタッフが見つかりません。" };
  if (snapshot.staff.some((s) => normName(s.name) === normName(person.name))) return { ok: false, error: `${person.name}さんはすでにこの請求に入っています。` };

  // 掛け持ちは可。ただし他の取引先の契約と同じ店舗で重なる場合は追加しない(二重請求を防ぐ)。
  const clients = await prisma.client.findMany({ select: { id: true, name: true, billingTerms: true } });
  const { others, conflict } = otherClientContracts(clients, invoice.clientId, invoice.yearMonth, person.name, storeName);
  if (conflict) return { ok: false, error: `${person.name}さんは他の取引先「${conflict}」の契約と、同じ店舗（${storeName}）で重なっているため、追加できません。契約を確認してください。` };

  const { staff, warnings } = await computeManualStaff(invoice.clientId, invoice.yearMonth, person.name, { storeName, rateExTax: input.rateExTax, absenceDeduction: input.absenceDeduction });
  if (!staff) return { ok: false, error: `${person.name}さんの${invoice.yearMonth}の稼働実績（出勤打刻のある、どの契約・稼働依頼にも入っていないシフト）がありません。` };

  const next: StatementSnapshot = {
    ...snapshot,
    staff: [...snapshot.staff, staff],
    warnings: [
      ...(snapshot.warnings ?? []),
      ...warnings,
      ...(others.length ? [`${staff.name}さんは他の取引先（${others.join("・")}）にも契約があります。追加した稼働日（${staff.dates.length}日）が、この取引先の分で合っているか確認してください。`] : []),
    ],
    // 追加したスタッフは「自動計算の元の値」にも入れる(次の作り直しで、手で直した項目と取り違えないため)。
    ...(snapshot.baseline
      ? { baseline: { ...snapshot.baseline, staff: [...snapshot.baseline.staff, { name: staff.name, dates: staff.dates, dayPlaces: staff.dayPlaces, serviceExTax: staff.serviceExTax, serviceCalc: staff.serviceCalc, travel: staff.travel }] } }
      : {}),
  };
  const unitPrice = statementBillableExTax(next);
  const totals = computeInvoiceTotals([{ quantity: 1, unitPriceExTax: unitPrice }]);
  const t = addTax(unitPrice);
  await prisma.$transaction([
    prisma.invoice.update({
      where: { id },
      data: { subtotalExTax: totals.subtotalExTax, taxAmount: totals.taxAmount, totalInclTax: totals.totalInclTax, statement: next },
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
  return { ok: true, message: `${staff.name}さんを追加しました（${staff.days}日・業務委託費 ¥${staff.serviceExTax.toLocaleString("ja-JP")}）。承認すると契約に自動登録されます。${others.length ? `他の取引先（${others.join("・")}）にも契約があるため、稼働日を確認してください。` : ""}` };
}

// 「承認」: 下書き → 承認済み(メールは送らない)。
export async function approveInvoice(id: string, approverName: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { registered, notes } = await approveDraftInvoice(id, approverName);
    revalidatePath(`/admin/invoices/${id}`);
    revalidatePath("/admin/invoices");
    revalidatePath("/admin/clients");
    const extra = [registered.length ? `契約を自動登録しました: ${registered.join(" / ")}` : "", ...notes].filter(Boolean).join(" ");
    return { ok: true, message: `承認しました。承認済みの一覧から送信できます。${extra ? ` ${extra}` : ""}` };
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

// 「削除」: 下書き・承認済みはそのまま削除できる。確定済み・送付済みの請求は、
// 取り返しがつかないため、請求番号を入力して確認した場合だけ削除する(メールを実際に送った記録も消える)。
export async function deleteInvoice(id: string, confirmInvoiceNumber?: string): Promise<ActionResult> {
  await requireAdmin();
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true, invoiceNumber: true } });
  if (!invoice) return { ok: false, error: "請求書が見つかりません。" };
  if (invoice.status !== "DRAFT" && invoice.status !== "APPROVED" && confirmInvoiceNumber?.trim() !== invoice.invoiceNumber) {
    return { ok: false, error: "確定済み・送付済みの請求を削除するには、請求番号を正しく入力してください。" };
  }
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
  // travelCalc: 交通費相当額の計算方法(1文)。travelLines: 行に分けた交通費(あれば合計はこちらの金額の合計になる)。
  staff: {
    dates: string[];
    dayPlaces?: Record<string, string>;
    serviceExTax: number;
    serviceCalc: string;
    travelInclTax: number;
    travelCalc?: string;
    travelLines?: { label: string; calc: string; amountExTax: number }[];
  }[];
  // 取引先全体の項目(新幹線代・広告原価・商材仕入れ代原価など)。金額は税抜。
  clientExtras: { label: string; amountExTax: number; calc?: string; store?: string; period?: string }[];
  // 明細書データがない古い請求だけ使う(業務委託費一式の税抜金額)。
  amountExTax?: number;
  // 請求書の品目。AUTO=「業務委託費一式」(取引先の設定によっては自動で分けた行) / MANUAL=手入力(manualLines)。明細書データがある請求だけ。
  lineMode?: "AUTO" | "MANUAL";
  manualLines?: { label: string; quantity: number; unitPriceExTax: number }[];
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
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true, yearMonth: true, statement: true, client: { select: { billingTerms: true } } } });
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
      for (const l of payload.staff[i].travelLines ?? []) {
        if (!l.label.trim()) return { ok: false, error: `${snapshot.staff[i].name}さんの交通費相当額の内訳に、項目名のない行があります。名前を入力するか、行を削除してください。` };
        if (!Number.isInteger(l.amountExTax) || l.amountExTax < 0) return { ok: false, error: `${snapshot.staff[i].name}さんの交通費相当額「${l.label.trim()}」の金額（税抜）は0以上の整数で入力してください。` };
      }
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
    // 品目の手入力: 空の行は無視する。MANUALなのに行がない、数量・単価が不正なときは保存しない。
    let manualLines: StatementSnapshot["manualLines"];
    if (payload.lineMode === "MANUAL") {
      manualLines = [];
      for (const m of payload.manualLines ?? []) {
        const label = m.label.trim();
        if (!label && !m.unitPriceExTax) continue;
        if (!label) return { ok: false, error: "品目に、名前のない行があります。名前を入力するか、行を削除してください。" };
        if (!Number.isInteger(m.quantity) || m.quantity < 1) return { ok: false, error: `品目「${label}」の数量は1以上の整数で入力してください。` };
        if (!Number.isInteger(m.unitPriceExTax) || m.unitPriceExTax < 0) return { ok: false, error: `品目「${label}」の単価（税抜）は0以上の整数で入力してください。` };
        manualLines.push({ label, quantity: m.quantity, unitPriceExTax: m.unitPriceExTax });
      }
      if (!manualLines.length) return { ok: false, error: "品目を手入力にする場合は、品目を1行以上入力してください。" };
    }
    const { manualLines: _dropManual, ...snapshotBase } = snapshot;
    void _dropManual;
    nextStatement = {
      ...snapshotBase,
      ...(manualLines ? { manualLines } : {}),
      clientExtras,
      staff: snapshot.staff.map((st, i) => {
        const dates = datesByStaff[i];
        const dayPlaces = dayPlacesByStaff[i];
        // 行に分けた交通費(店舗別・新幹線代など)は、金額(税抜)の合計が交通費相当額になる。
        const tLines = (payload.staff[i].travelLines ?? [])
          .map((l) => ({ label: l.label.trim(), calc: l.calc.trim(), amountExTax: l.amountExTax }))
          .filter((l) => l.label);
        const useLines = payload.staff[i].travelLines !== undefined;
        const raw = payload.staff[i].travelInclTax;
        const lineEx = tLines.reduce((a, l) => a + l.amountExTax, 0);
        const incl = useLines ? addTax(lineEx).amountIncl * (lineEx > 0 ? 1 : 0) : Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
        const ex = useLines ? lineEx : incl > 0 ? splitInclusiveTax(incl).amountEx : 0;
        // 1文の計算方法: 金額を変えたのに古い文のままのときは、自動表示に戻す。
        const calcText = payload.staff[i].travelCalc?.trim();
        const calc = calcText === undefined ? (st.travel.calc && st.travel.amountInclTax === incl ? st.travel.calc : undefined)
          : calcText && !(incl !== st.travel.amountInclTax && calcText === st.travel.calc) ? calcText : undefined;
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
            ...(calc && !useLines ? { calc } : {}),
            ...(useLines
              ? tLines.length ? { lines: tLines } : {}
              : st.travel.lines?.length && st.travel.amountInclTax === incl && payload.staff[i].travelLines === undefined ? { lines: st.travel.lines } : {}),
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

  // 請求書の品目: 取引先の設定がONなら「稼働費用（スタッフ名）」「交通費相当額」などに分ける。それ以外は「業務委託費一式」。
  const split = !!((invoice.client.billingTerms ?? {}) as BillingTerms).splitInvoiceLines;
  const lines = nextStatement ? buildInvoiceLines(nextStatement, split) : buildInvoiceLines({ staff: [], clientExtras: [{ label: "業務委託費一式", amountExTax: unitPrice, amountInclTax: addTax(unitPrice).amountIncl }] }, false);
  const totals = computeInvoiceTotals(lines);
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
    prisma.invoiceLine.createMany({ data: lines.map((l) => ({ ...l, invoiceId: id })) }),
  ]);
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath("/admin/invoices");

  if (!approveAfter || invoice.status !== "DRAFT") return { ok: true, message: "修正を保存しました。" };
  return approveInvoice(id, approverName);
}

// 「訂正版を作成」: 送付済みの請求を、そのまま写した新しい版(訂正版・下書き)にする。
// 送付済みの請求は書き換えず残す(送付した記録を守るため)。訂正版を直して承認・送信する。
export async function createCorrection(id: string): Promise<CreateDraftResult> {
  await requireAdmin();
  try {
    const r = await createCorrectionDraft(id);
    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${id}`);
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "訂正版の作成に失敗しました。" };
  }
}
