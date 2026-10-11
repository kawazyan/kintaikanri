import { prisma } from "@/lib/prisma";
import {
  computeEstimateTotals,
  estimateUnitExTax,
  filledLines,
  formatEstimateNumber,
  nextEstimateSeq,
  estimateNumberPrefix,
  validateEstimateInput,
  type EstimateInput,
} from "@/lib/estimate";
import { splitEmails } from "@/lib/invoice-defaults";
import { toJstDateValue } from "@/lib/time";

// 保存する値に整える。必須の項目はないので、空の項目は空のまま(取引先・店舗名・送信先は null)保存する。
// 発行日だけは見積番号(年月)に使うため、空なら今日(日本時間)にする。
function normalize(input: EstimateInput) {
  const filled = filledLines(input.lines);
  const totals = computeEstimateTotals(input.taxMode, filled);
  const emails = [...new Set(splitEmails(input.recipientEmails))];
  return {
    clientId: input.clientId?.trim() || null,
    issuedDate: input.issuedDate?.trim() || toJstDateValue(new Date()),
    addressee: input.addressee.trim(),
    subject: input.subject.trim(),
    storeName: input.storeName?.trim() || null,
    recipientEmails: emails.length ? emails.join(", ") : null,
    note: input.note?.trim() || null,
    taxMode: input.taxMode,
    subtotalExTax: totals.subtotalExTax,
    taxAmount: totals.taxAmount,
    totalInclTax: totals.totalInclTax,
    rows: filled.map((l, i) => ({
      sortOrder: (i + 1) * 10,
      label: l.label.trim(),
      description: l.description?.trim() || null,
      quantity: l.quantity,
      unitPriceExTax: estimateUnitExTax(input.taxMode, l.unitPrice),
      unitPriceInclTax: input.taxMode === "INCL" ? l.unitPrice : null,
    })),
  };
}

async function assertClientExists(clientId: string | null) {
  if (!clientId) return;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new Error("取引先が見つかりません。");
}

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

// 新しい見積書を保存する(まだ送らない)。見積番号は発行日の年月ごとに001から自動で付ける。
// 同時に作って番号がぶつかったときは、番号を取り直してやり直す。
export async function createEstimate(input: EstimateInput) {
  const problem = validateEstimateInput(input);
  if (problem) throw new Error(problem);
  const { rows, ...data } = normalize(input);
  await assertClientExists(data.clientId);

  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.estimate.findMany({
      where: { estimateNumber: { startsWith: estimateNumberPrefix(data.issuedDate) } },
      select: { estimateNumber: true },
    });
    const estimateNumber = formatEstimateNumber(data.issuedDate, nextEstimateSeq(existing.map((e) => e.estimateNumber), data.issuedDate));
    try {
      return await prisma.estimate.create({
        data: { ...data, estimateNumber, status: "SAVED", lines: { create: rows } },
        select: { id: true, estimateNumber: true },
      });
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) continue;
      throw e;
    }
  }
  throw new Error("見積番号を付けられませんでした。もう一度お試しください。");
}

// 保存済み(未送付)の見積書を直す。見積番号は変わらない(発行日の年月を変えても同じ)。送付済みの見積書は直せない。
export async function updateEstimate(id: string, input: EstimateInput) {
  const problem = validateEstimateInput(input);
  if (problem) throw new Error(problem);
  const current = await prisma.estimate.findUnique({ where: { id }, select: { status: true, estimateNumber: true } });
  if (!current) throw new Error("見積書が見つかりません。");
  if (current.status !== "SAVED") throw new Error("送付済みの見積書は修正できません。");
  const { rows, ...data } = normalize(input);
  await assertClientExists(data.clientId);

  await prisma.$transaction([
    prisma.estimate.update({ where: { id }, data }),
    prisma.estimateLine.deleteMany({ where: { estimateId: id } }),
    prisma.estimateLine.createMany({ data: rows.map((r) => ({ ...r, estimateId: id })) }),
  ]);
  return { id, estimateNumber: current.estimateNumber };
}
