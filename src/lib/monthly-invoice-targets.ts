import { activeShiftRules, type BillingTerms } from "@/lib/billing-terms";

// 月初の自動作成で、前月分の請求下書きを作る対象の取引先。
// ・承認済みの稼働依頼がある取引先(従来どおり)
// ・その月に有効な契約ルール(Client.billingTerms.shiftBilling)がある、利用中の取引先(稼働依頼を使わない運用)
// 稼働がなければ下書きは作られない(作成側が判定する)。純粋関数。
export function invoiceTargetClientIds(
  orderClientIds: string[],
  clients: { id: string; active: boolean; billingTerms: unknown }[],
  yearMonth: string
): string[] {
  const ids = new Set(orderClientIds);
  for (const c of clients) {
    if (c.active && activeShiftRules(c.billingTerms as BillingTerms | null, yearMonth).length > 0) ids.add(c.id);
  }
  return [...ids];
}
