import { prisma } from "@/lib/prisma";
import { carrierStorePrefix } from "@/lib/carriers";
import { activeShiftRules, normName, type BillingTerms } from "@/lib/billing-terms";

// スタッフがシフトを登録するとき、取引先の契約(Client.billingTerms.shiftBilling)に「正式な店舗名」があれば、店舗名を自動で決める。
// 自動にするのは「その月に有効な契約(特定日だけの契約を除く)が1件だけで、正式な店舗名が入っている」ときだけ。
// 掛け持ちなどで契約が複数あるときは、どの店舗か決められないので、これまでどおり本人が入力する。
export type ContractStore = { storeName: string; clientName: string; carrierPrefix: boolean };

// 月ごとの結果(自動にならない月は含めない)。取引先は1回だけ読む。
export async function contractStoresFor(staffId: string, yearMonths: string[]): Promise<Record<string, ContractStore>> {
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { name: true } });
  if (!staff) return {};
  const clients = await prisma.client.findMany({ select: { name: true, billingTerms: true } });
  const out: Record<string, ContractStore> = {};
  for (const ym of yearMonths) {
    const hits: { clientName: string; storeName?: string; carrierPrefix: boolean }[] = [];
    for (const c of clients) {
      for (const r of activeShiftRules(c.billingTerms as BillingTerms | null, ym)) {
        if (normName(r.staffName) !== normName(staff.name) || r.dates?.length) continue;
        hits.push({ clientName: c.name, storeName: r.storeName?.trim() || undefined, carrierPrefix: r.storeKind === "SHOP" });
      }
    }
    if (hits.length === 1 && hits[0].storeName) out[ym] = { storeName: hits[0].storeName, clientName: hits[0].clientName, carrierPrefix: hits[0].carrierPrefix };
  }
  return out;
}

export async function contractStoreFor(staffId: string, yearMonth: string): Promise<ContractStore | null> {
  return (await contractStoresFor(staffId, [yearMonth]))[yearMonth] ?? null;
}

// シフトに保存する店舗名。店の種類が「ショップ」の契約で、キャリアに付ける言葉があれば先頭に付ける(すでに付いていれば重ねない)。量販店はそのまま。
export function storeNameForShift(store: ContractStore, carrier: string): string {
  const prefix = store.carrierPrefix ? carrierStorePrefix(carrier) : null;
  return prefix && !store.storeName.startsWith(prefix) ? `${prefix}${store.storeName}` : store.storeName;
}
