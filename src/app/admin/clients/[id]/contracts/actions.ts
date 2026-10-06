"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { BillingTerms, ShiftBillingRule } from "@/lib/billing-terms";

export type ContractInput = {
  staffName: string;
  storeMatch: string[];
  dates: string[]; // 特定日だけ(YYYY-MM-DD)。空=日付を問わない
  fromMonth: string;
  toMonth: string;
  contract: "DAILY" | "MONTHLY";
  rateExTax: number;
  absenceDeduction: "YES" | "NO";
  plannedDays: number;
  flatTravelExTax: number;
  note: string;
};

const MONTH = /^\d{4}-\d{2}$/;

async function load(clientId: string) {
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { billingTerms: true } });
  if (!c) throw new Error("取引先が見つかりません。");
  const terms = (c.billingTerms ?? {}) as BillingTerms;
  return { terms, rules: [...(terms.shiftBilling ?? [])] };
}

async function save(clientId: string, terms: BillingTerms, rules: ShiftBillingRule[]) {
  // 契約以外の取り決め(交通費・毎月の固定加算・イベント代理店ID)はそのまま残す。
  await prisma.client.update({ where: { id: clientId }, data: { billingTerms: { ...terms, shiftBilling: rules } as object } });
  revalidatePath(`/admin/clients/${clientId}/contracts`);
}

// index が null なら追加、数値ならその行を更新する。dates(特定日指定)など画面に出さない項目は既存の値を残す。
export async function adminSaveContract(clientId: string, index: number | null, input: ContractInput) {
  await requireAdmin();
  const staffName = input.staffName.trim();
  if (!staffName) throw new Error("スタッフを選んでください。");
  if (!(input.rateExTax > 0)) throw new Error("単価(税抜)を入力してください。");
  if (input.dates.some((x) => !/^\d{4}-\d{2}-\d{2}$/.test(x))) throw new Error("日付の形式が正しくありません(例: 2026-10-03)。");
  if (input.fromMonth && !MONTH.test(input.fromMonth)) throw new Error("開始月の形式が正しくありません。");
  if (input.toMonth && !MONTH.test(input.toMonth)) throw new Error("終了月の形式が正しくありません。");
  if (input.contract === "MONTHLY" && input.absenceDeduction === "YES" && !(input.plannedDays > 0)) {
    throw new Error("欠勤で減算する場合は、予定日数を入力してください。");
  }

  const { terms, rules } = await load(clientId);
  const prev = index != null ? rules[index] : undefined;
  if (index != null && !prev) throw new Error("対象の契約が見つかりません。画面を開き直してください。");

  const rule: ShiftBillingRule = {
    ...(prev ?? {}),
    staffName,
    storeMatch: input.storeMatch.length ? input.storeMatch : undefined,
    dates: input.dates.length ? input.dates : undefined,
    fromMonth: input.fromMonth || undefined,
    toMonth: input.toMonth || undefined,
    contract: input.contract,
    rateExTax: input.rateExTax,
    absenceDeduction: input.contract === "MONTHLY" ? input.absenceDeduction : undefined,
    plannedDays: input.contract === "MONTHLY" && input.absenceDeduction === "YES" ? input.plannedDays : undefined,
    flatTravelExTax: input.flatTravelExTax > 0 ? input.flatTravelExTax : undefined,
    note: input.note.trim() || undefined,
  };
  if (index != null) rules[index] = rule;
  else rules.push(rule);
  await save(clientId, terms, rules);
}

export async function adminDeleteContract(clientId: string, index: number) {
  await requireAdmin();
  const { terms, rules } = await load(clientId);
  if (!rules[index]) throw new Error("対象の契約が見つかりません。画面を開き直してください。");
  rules.splice(index, 1);
  await save(clientId, terms, rules);
}

// 請求書の品目を「稼働費用（スタッフ名）」「交通費相当額」などに分けて表示するか。他の取り決めはそのまま残す。
export async function setSplitInvoiceLines(clientId: string, formData: FormData) {
  await requireAdmin();
  const { terms, rules } = await load(clientId);
  const on = formData.get("splitInvoiceLines") === "on";
  await save(clientId, { ...terms, splitInvoiceLines: on || undefined }, rules);
}
