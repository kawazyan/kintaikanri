import { prisma } from "@/lib/prisma";
import { computeMonthlyEarnings } from "@/lib/earnings";
import { splitInclusiveTax } from "@/lib/billing";
import { activeShiftRules, normName, type BillingTerms } from "@/lib/billing-terms";
import { computeRuleServiceForStaff } from "@/lib/invoice-draft";
import { computeReferralPart, referralMemo } from "@/lib/referral-calc";
import { recordAudit, yenText } from "@/lib/audit";
import { currentJstYearMonth } from "@/lib/time";

// 紹介リファラル(渡辺さん)の自動計算。支払い月ごとに、承認済みの別途報酬(REFERRAL)を自動で作る・更新する。
//   リファラル = 日割り後の単価 − 会社取り分 − 日割り後の本人支払い(紹介された人ごと。計算は referral-calc.ts)
// ・稼働月 = 支払い月 − 紹介された人の「支払い月のずれ」(当月払い=当月分 / 翌月払い=前月分)
// ・単価の日割りは請求書と同じ(invoice-draft.ts の staffFromRule)、本人支払いは earnings.ts と同じ
// ・振込済みになった行、却下された行は触らない。手入力のリファラル申請がある月は、二重に払わないよう自動では作らない
// ・出勤日数が増えるたびに金額が積み上がる(月末まで再計算される)

export const AUTO_REFERRAL_REVIEWER = "自動計算(リファラル)";

const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export type ReferralSyncResult = { created: number; updated: number; skipped: string[] };

export async function syncReferralCompensation(paymentMonth: string, now: Date = new Date()): Promise<ReferralSyncResult> {
  const result: ReferralSyncResult = { created: 0, updated: 0, skipped: [] };
  if (paymentMonth > currentJstYearMonth(now)) return result; // 来月以降は作らない

  const links = await prisma.referralLink.findMany({ where: { fromMonth: { lte: paymentMonth } } });
  if (!links.length) return result;
  const byReferrer = new Map<string, typeof links>();
  for (const l of links) (byReferrer.get(l.referrerStaffId) ?? byReferrer.set(l.referrerStaffId, []).get(l.referrerStaffId)!).push(l);

  const clients = await prisma.client.findMany({ select: { id: true, name: true, billingTerms: true } });

  for (const [referrerId, refLinks] of byReferrer) {
    const rows = await prisma.compensationRequest.findMany({
      where: { staffId: referrerId, yearMonth: paymentMonth, category: "REFERRAL" },
      select: { id: true, status: true, paidAt: true, reviewerName: true, amountTaxInclusive: true, createdAt: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const autoRows = rows.filter((r) => r.reviewerName === AUTO_REFERRAL_REVIEWER);
    if (rows.some((r) => r.reviewerName !== AUTO_REFERRAL_REVIEWER && r.status !== "REJECTED")) {
      result.skipped.push(`${paymentMonth}: 手入力のリファラル申請があるため自動作成しない`);
      continue;
    }
    const existing = autoRows[0] ?? null;
    if (existing && (existing.paidAt !== null || existing.status !== "APPROVED")) continue; // 振込済み・却下は触らない

    const referees = await prisma.staff.findMany({
      where: { id: { in: refLinks.map((l) => l.refereeStaffId) } },
      select: { id: true, name: true, employeeCode: true, fixedPaymentMonthOffset: true },
      orderBy: { employeeCode: "asc" },
    });

    const items: { label: string; amount: number; memo: string }[] = [];
    let failed = 0; // 計算できなかった人がいる(一部の人だけで承認済みの申請を作ると、払い漏れになるため)
    for (const person of referees) {
      const link = refLinks.find((l) => l.refereeStaffId === person.id)!;
      const workMonth = shiftMonth(paymentMonth, -(person.fixedPaymentMonthOffset ?? 0));
      const owners = clients.filter((c) => activeShiftRules(c.billingTerms as BillingTerms | null, workMonth).some((r) => normName(r.staffName) === normName(person.name)));
      if (owners.length !== 1) {
        result.skipped.push(`${person.name}: ${workMonth}の請求契約が${owners.length}社あるため計算できない`);
        failed++;
        continue;
      }
      const service = await computeRuleServiceForStaff(owners[0].billingTerms as BillingTerms, workMonth, person.name);
      if (!service) {
        result.skipped.push(`${person.name}: ${workMonth}の請求対象の稼働がない（契約の店舗名・期間と合っているか確認）`);
        failed++;
        continue;
      }
      const own = (await computeMonthlyEarnings(person.id, workMonth, now)).confirmedAmount;
      if (own === null) {
        result.skipped.push(`${person.name}: ${workMonth}の本人支払いが未確定`);
        failed++;
        continue;
      }
      const part = computeReferralPart(service.serviceExTax, own, link.companyPercent);
      items.push({
        label: `${person.name.replace(/[\s　]+/g, " ")}（${Number(workMonth.slice(5))}月分）`,
        amount: part.referral,
        memo: referralMemo(part, link.companyPercent, service.serviceCalc),
      });
    }
    if (failed > 0 || !items.length) continue; // 全員ぶん計算できたときだけ作る・更新する

    const total = items.reduce((s, i) => s + i.amount, 0);
    const description = `自動計算（紹介リファラル）\n${items.map((i) => `${i.label} ${yenText(i.amount)}`).join("\n")}`;
    const tax = splitInclusiveTax(total, 10);
    const itemData = items.map((it, i) => ({ sortOrder: i, label: it.label, amount: it.amount, memo: it.memo }));

    if (!existing) {
      const nowDate = new Date();
      const created = await prisma.compensationRequest.create({
        data: {
          staffId: referrerId, yearMonth: paymentMonth, category: "REFERRAL", description,
          amountTaxInclusive: total, amountExTax: tax.amountEx, taxAmount: tax.tax, taxRate: 10,
          status: "APPROVED", submittedAt: nowDate, reviewedAt: nowDate, reviewerName: AUTO_REFERRAL_REVIEWER,
          items: { create: itemData },
        },
        select: { id: true },
      });
      // 同時に2か所から作られたときの重複は、古い1件だけ残す
      const dup = await prisma.compensationRequest.findMany({
        where: { staffId: referrerId, yearMonth: paymentMonth, category: "REFERRAL", reviewerName: AUTO_REFERRAL_REVIEWER },
        select: { id: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      if (dup.length > 1) {
        await prisma.compensationRequest.deleteMany({ where: { id: { in: dup.slice(1).map((d) => d.id) }, paidAt: null } });
        if (dup[0].id !== created.id) continue;
      }
      await recordAudit({
        staffId: referrerId, category: "COMPENSATION", action: "REFERRAL_AUTO_CREATED", yearMonth: paymentMonth,
        summary: `リファラル報酬を自動作成（承認済み）: ${yenText(total)}（${items.map((i) => `${i.label} ${yenText(i.amount)}`).join("、")}）`,
        after: { amount: total }, actor: { type: "ADMIN", operatorName: AUTO_REFERRAL_REVIEWER },
      });
      result.created++;
    } else if (existing.amountTaxInclusive !== total) {
      await prisma.$transaction([
        prisma.compensationRequestItem.deleteMany({ where: { requestId: existing.id } }),
        prisma.compensationRequest.update({
          where: { id: existing.id },
          data: { description, amountTaxInclusive: total, amountExTax: tax.amountEx, taxAmount: tax.tax, items: { create: itemData } },
        }),
      ]);
      await recordAudit({
        staffId: referrerId, category: "COMPENSATION", action: "REFERRAL_AUTO_UPDATED", yearMonth: paymentMonth,
        summary: `リファラル報酬を再計算: ${yenText(existing.amountTaxInclusive)} → ${yenText(total)}`,
        before: { amount: existing.amountTaxInclusive }, after: { amount: total },
        actor: { type: "ADMIN", operatorName: AUTO_REFERRAL_REVIEWER },
      });
      result.updated++;
    } else {
      // 金額が同じでも、内訳の文面(出勤日数など)が変わっていれば内訳だけ更新する
      const cur = await prisma.compensationRequest.findUnique({ where: { id: existing.id }, select: { description: true } });
      if (cur?.description !== description) {
        await prisma.$transaction([
          prisma.compensationRequestItem.deleteMany({ where: { requestId: existing.id } }),
          prisma.compensationRequest.update({ where: { id: existing.id }, data: { description, items: { create: itemData } } }),
        ]);
      }
    }
  }
  return result;
}
