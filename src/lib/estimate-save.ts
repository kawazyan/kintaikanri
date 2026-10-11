import { prisma } from "@/lib/prisma";
import {
  computeEstimateTotals,
  estimateUnitExTax,
  formatEstimateNumber,
  nextEstimateSeq,
  estimateNumberPrefix,
  validateEstimateInput,
  type EstimateInput,
} from "@/lib/estimate";

// 空の行(名前も単価もない行)は取り除いて、保存する行の形にする。
function toLineRows(input: EstimateInput) {
  return input.lines
    .filter((l) => l.label.trim() || l.unitPrice)
    .map((l, i) => ({
      sortOrder: (i + 1) * 10,
      label: l.label.trim(),
      description: l.description?.trim() || null,
      quantity: l.quantity,
      unitPriceExTax: estimateUnitExTax(input.taxMode, l.unitPrice),
      unitPriceInclTax: input.taxMode === "INCL" ? l.unitPrice : null,
    }));
}

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

// 新しい見積書を保存する(まだ送らない)。見積番号は発行日の年月ごとに001から自動で付ける。
// 同時に作って番号がぶつかったときは、番号を取り直してやり直す。
export async function createEstimate(input: EstimateInput) {
  const problem = validateEstimateInput(input);
  if (problem) throw new Error(problem);
  const client = await prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } });
  if (!client) throw new Error("取引先が見つかりません。");

  const rows = toLineRows(input);
  const totals = computeEstimateTotals(input.taxMode, input.lines.filter((l) => l.label.trim() || l.unitPrice));

  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.estimate.findMany({
      where: { estimateNumber: { startsWith: estimateNumberPrefix(input.issuedDate) } },
      select: { estimateNumber: true },
    });
    const estimateNumber = formatEstimateNumber(input.issuedDate, nextEstimateSeq(existing.map((e) => e.estimateNumber), input.issuedDate));
    try {
      const created = await prisma.estimate.create({
        data: {
          clientId: input.clientId,
          estimateNumber,
          status: "SAVED",
          issuedDate: input.issuedDate,
          addressee: input.addressee.trim(),
          subject: input.subject.trim(),
          note: input.note?.trim() || null,
          taxMode: input.taxMode,
          subtotalExTax: totals.subtotalExTax,
          taxAmount: totals.taxAmount,
          totalInclTax: totals.totalInclTax,
          lines: { create: rows },
        },
        select: { id: true, estimateNumber: true },
      });
      return created;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) continue;
      throw e;
    }
  }
  throw new Error("見積番号を付けられませんでした。もう一度お試しください。");
}

// 保存済み(未送付)の見積書を直す。見積番号は変わらない。送付済みの見積書は直せない。
export async function updateEstimate(id: string, input: EstimateInput) {
  const problem = validateEstimateInput(input);
  if (problem) throw new Error(problem);
  const current = await prisma.estimate.findUnique({ where: { id }, select: { status: true, estimateNumber: true } });
  if (!current) throw new Error("見積書が見つかりません。");
  if (current.status !== "SAVED") throw new Error("送付済みの見積書は修正できません。");
  const client = await prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } });
  if (!client) throw new Error("取引先が見つかりません。");

  const rows = toLineRows(input);
  const totals = computeEstimateTotals(input.taxMode, input.lines.filter((l) => l.label.trim() || l.unitPrice));
  await prisma.$transaction([
    prisma.estimate.update({
      where: { id },
      data: {
        clientId: input.clientId,
        issuedDate: input.issuedDate,
        addressee: input.addressee.trim(),
        subject: input.subject.trim(),
        note: input.note?.trim() || null,
        taxMode: input.taxMode,
        subtotalExTax: totals.subtotalExTax,
        taxAmount: totals.taxAmount,
        totalInclTax: totals.totalInclTax,
      },
    }),
    prisma.estimateLine.deleteMany({ where: { estimateId: id } }),
    prisma.estimateLine.createMany({ data: rows.map((r) => ({ ...r, estimateId: id })) }),
  ]);
  return { id, estimateNumber: current.estimateNumber };
}
