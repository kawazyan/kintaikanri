import { prisma } from "@/lib/prisma";
import { activeShiftRules, normName, ruleMatchesShift, type BillingTerms, type ShiftBillingRule } from "@/lib/billing-terms";
import { jstMonthRange, toJstDateValue } from "@/lib/time";

// 「このシフトは、どのクライアントの分か」を決める。
// 1) 稼働依頼に紐付いているシフト → その依頼のクライアント(従来どおり)
// 2) 紐付いていないシフト → 各クライアントの「契約」(Client.billingTerms.shiftBilling)の
//    スタッフ名・店舗名・日付・期間に当てはまるクライアント
// 2社以上に当てはまるシフトは自動では決めない(請求・閲覧ページのどちらにも含めず、管理画面で「要確認」と出す)。

export type RuleIndex = {
  yearMonth: string;
  clients: { id: string; name: string; rules: ShiftBillingRule[] }[];
  /** その月に、スタッフ・店舗・日付が当てはまるクライアントIDの一覧(0社=どこにも当てはまらない)。 */
  owners: (staffName: string, storeName: string, dateKey: string) => string[];
};

export async function loadRuleIndex(yearMonth: string): Promise<RuleIndex> {
  const all = await prisma.client.findMany({ select: { id: true, name: true, billingTerms: true } });
  const clients = all
    .map((c) => ({ id: c.id, name: c.name, rules: activeShiftRules(c.billingTerms as BillingTerms | null, yearMonth) }))
    .filter((c) => c.rules.length > 0);
  return {
    yearMonth,
    clients,
    owners: (staffName, storeName, dateKey) =>
      clients.filter((c) => c.rules.some((r) => ruleMatchesShift(r, staffName, storeName, dateKey))).map((c) => c.id),
  };
}

export type ClientShiftRef = { id: string; staffId: string; startTime: Date };

// そのクライアントの、その月のシフト(キャンセル済みも含む)。
export async function findShiftsForClient(clientId: string, yearMonth: string, index?: RuleIndex): Promise<ClientShiftRef[]> {
  const { start, end } = jstMonthRange(yearMonth);
  const idx = index ?? (await loadRuleIndex(yearMonth));

  const linked = await prisma.shift.findMany({
    where: { startTime: { gte: start, lt: end }, workOrderStaff: { workOrder: { clientId } } },
    select: { id: true, staffId: true, startTime: true },
  });

  const mine = idx.clients.find((c) => c.id === clientId);
  if (!mine) return linked;
  const names = [...new Set(mine.rules.map((r) => normName(r.staffName)))];
  const people = (await prisma.staff.findMany({ select: { id: true, name: true } })).filter((p) => names.includes(normName(p.name)));
  if (!people.length) return linked;

  const unlinked = await prisma.shift.findMany({
    where: { staffId: { in: people.map((p) => p.id) }, workOrderStaffId: null, startTime: { gte: start, lt: end } },
    select: { id: true, staffId: true, startTime: true, storeName: true },
  });
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const matched = unlinked.filter((s) => {
    const owners = idx.owners(nameOf.get(s.staffId) ?? "", s.storeName, toJstDateValue(s.startTime));
    return owners.length === 1 && owners[0] === clientId; // 2社以上に当てはまるものは含めない
  });
  return [...linked, ...matched.map(({ id, staffId, startTime }) => ({ id, staffId, startTime }))];
}
