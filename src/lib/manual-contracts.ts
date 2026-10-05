import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activeShiftRules, normName, type BillingTerms, type ShiftBillingRule } from "@/lib/billing-terms";
import type { StatementSnapshot } from "@/lib/invoice-draft";

// 承認時に、請求書の画面で「スタッフを追加」したスタッフを取引先の契約(Client.billingTerms.shiftBilling)へ自動登録する。
// 請求書に書いた内容が正: 店舗名・月額(欠勤控除する前の税抜)・欠勤控除の有無をそのまま契約にし、
// 当月の該当シフト・打刻の店舗名も請求書の表記に統一する。実際の書き込みは承認と同じトランザクションで行う。
// 他の取引先の契約に同じスタッフがいる場合は、登録せず(承認も止めて)エラーにする。

export type ManualContractPlan = { ops: Prisma.PrismaPromise<unknown>[]; registered: string[]; notes: string[] };

export async function planManualContracts(invoice: { clientId: string; yearMonth: string; statement: unknown }): Promise<ManualContractPlan> {
  const st = invoice.statement as StatementSnapshot | null;
  const manualStaff = (st?.staff ?? []).filter((s) => s.manual);
  const plan: ManualContractPlan = { ops: [], registered: [], notes: [] };
  if (!manualStaff.length) return plan;

  const [clients, people] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true, billingTerms: true } }),
    prisma.staff.findMany({ select: { id: true, name: true } }),
  ]);
  const mine = clients.find((c) => c.id === invoice.clientId);
  if (!mine) throw new Error("取引先が見つかりません。");
  const terms = (mine.billingTerms ?? {}) as BillingTerms;
  const rules: ShiftBillingRule[] = [...(terms.shiftBilling ?? [])];
  let added = false;

  for (const s of manualStaff) {
    const m = s.manual!;
    const matched = people.filter((p) => normName(p.name) === normName(s.name));
    if (matched.length !== 1) throw new Error(`${s.name}さんを社内スタッフから1人に特定できないため、契約を登録できません。`);
    const person = matched[0];

    const other = clients.find(
      (c) => c.id !== invoice.clientId && activeShiftRules(c.billingTerms as BillingTerms | null, invoice.yearMonth).some((r) => normName(r.staffName) === normName(s.name))
    );
    if (other) throw new Error(`${s.name}さんは他の取引先「${other.name}」の契約に登録されています。二重に請求しないよう、契約を確認してから承認してください。`);

    const exists = rules.some(
      (r) =>
        normName(r.staffName) === normName(s.name) &&
        (!r.fromMonth || invoice.yearMonth >= r.fromMonth) &&
        (!r.toMonth || invoice.yearMonth <= r.toMonth) &&
        !!r.storeMatch?.some((x) => m.storeName.includes(x))
    );
    if (exists) {
      plan.notes.push(`${s.name}さんは、すでに同じ店舗の契約があるため、契約は新しく登録していません。`);
    } else {
      rules.push({
        staffName: person.name,
        storeMatch: [m.storeName],
        fromMonth: invoice.yearMonth,
        contract: "MONTHLY",
        rateExTax: m.rateExTax,
        absenceDeduction: m.absenceDeduction,
        plannedDays: m.absenceDeduction === "YES" && m.plannedDays > 0 ? m.plannedDays : undefined,
      });
      added = true;
      plan.registered.push(`${person.name}（${m.storeName}・月額¥${m.rateExTax.toLocaleString("ja-JP")}・欠勤控除${m.absenceDeduction === "YES" ? "あり" : "なし"}・${invoice.yearMonth}から）`);
      if (m.absenceDeduction !== "YES" && s.serviceExTax !== m.rateExTax) {
        plan.notes.push(`${s.name}さんの請求書の業務委託費(¥${s.serviceExTax.toLocaleString("ja-JP")})は、登録する月額(¥${m.rateExTax.toLocaleString("ja-JP")})と異なります。契約には月額の方を登録しました。`);
      }
    }

    // 稼働日のシフト・打刻の店舗名を、請求書の表記に統一する(稼働依頼に紐付いていないシフトだけ)。
    for (const d of s.dates) {
      const dayStart = new Date(`${d}T00:00:00+09:00`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const shiftWhere = { staffId: person.id, cancelledAt: null, workOrderStaffId: null, startTime: { gte: dayStart, lt: dayEnd } };
      plan.ops.push(prisma.clockRecord.updateMany({ where: { shift: shiftWhere }, data: { storeName: m.storeName } }));
      plan.ops.push(prisma.shift.updateMany({ where: shiftWhere, data: { storeName: m.storeName } }));
    }
  }

  if (added) {
    plan.ops.push(prisma.client.update({ where: { id: invoice.clientId }, data: { billingTerms: { ...terms, shiftBilling: rules } as object } }));
  }
  return plan;
}
