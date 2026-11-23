"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteGameData } from "@/lib/game";
import { operatorNameFrom, recordAudit } from "@/lib/audit";

// 報酬・支払いに関わる設定の変更履歴用(スタッフ詳細の保存で変わった項目だけを「変更前 → 変更後」で残す)。
const PAY_SETTING_LABELS: Record<string, string> = {
  paymentMethod: "支払方法",
  fixedClosingDay: "締め日",
  fixedPaymentMonthOffset: "支払月(0=当月・1=翌月)",
  fixedPaymentDay: "支払日(0=月末)",
  payType: "報酬タイプ",
  dailyRate: "日当",
  monthlyAmount: "月額",
  travelExpenseIncluded: "交通費込み",
  dailyTravelInclTax: "1日あたりの交通費",
};
function payFieldText(key: string, v: string | number | boolean | null): string {
  if (v === null) return "未設定";
  if (key === "paymentMethod") return v === "FIXED" ? "固定支払" : "申請支払";
  if (key === "payType") return v === "DAILY" ? "日当" : v === "MONTHLY" ? "月固定" : v === "MANUAL" ? "手入力" : "未設定";
  if (key === "travelExpenseIncluded") return v ? "交通費込み" : "交通費別";
  if (key === "dailyRate" || key === "monthlyAmount" || key === "dailyTravelInclTax") return `${Number(v).toLocaleString("ja-JP")}円`;
  return String(v);
}

export async function createStaff(formData: FormData) {
  await requireAdmin();
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!employeeCode || !name || !email) return;

  await prisma.staff.create({ data: { employeeCode, name, email } });
  revalidatePath("/admin/staff");
}

export async function updateStaff(staffId: string, formData: FormData) {
  await requireAdmin();
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const status = String(formData.get("status") ?? "ACTIVE") as "ACTIVE" | "RETIRED";
  const showRetired = String(formData.get("showRetired") ?? "") === "1";
  if (!employeeCode || !name || !email) return;

  const before = await prisma.staff.findUnique({ where: { id: staffId }, select: { status: true } });

  await prisma.staff.update({
    where: { id: staffId },
    data: { employeeCode, name, email, status },
  });

  // ゲームデータ(称号・皆勤賞)は退職と同時に無効化する。異動等では削除しない。
  if (before?.status === "ACTIVE" && status === "RETIRED") {
    await deleteGameData(staffId);
  }

  revalidatePath("/admin/staff");
  // 保存後にページを作り直させることで、フォームの各項目が確実に最新の
  // 保存内容で再表示されるようにする(updateStaffDetails と同じ理由)。
  redirect(`/admin/staff?saved=1${showRetired ? "&showRetired=1" : ""}`);
}

export async function adminBulkDeleteStaff(staffIds: string[]) {
  await requireAdmin();
  const results: { id: string; ok: boolean }[] = [];
  for (const id of staffIds) {
    try {
      await prisma.staff.delete({ where: { id } });
      results.push({ id, ok: true });
    } catch {
      // 打刻・シフト・経費など履歴が残っているスタッフは外部キー制約により削除できない。
      results.push({ id, ok: false });
    }
  }
  revalidatePath("/admin/staff");
  const blockedIds = results.filter((r) => !r.ok).map((r) => r.id);
  return { deleted: results.length - blockedIds.length, failed: blockedIds.length, blockedIds };
}

// 打刻・シフト・経費などの履歴があっても強制的にスタッフごと削除する。
// 通常の adminBulkDeleteStaff とは別の、明示的に選んだ場合のみ呼ばれる操作。
// 稼働依頼(WorkOrderStaff)は請求・稼働実績の記録として残すため削除せず、
// staffId だけ外して「スタッフ一覧外の稼働者」扱いに戻す(手入力名は既存の
// requestedName がそのまま使われる)。それ以外の打刻・シフト・経費等の
// 個人履歴は完全に削除される。元に戻せない。
export async function adminForceDeleteStaff(staffIds: string[]) {
  await requireAdmin();
  let deleted = 0;
  for (const id of staffIds) {
    try {
      await prisma.$transaction([
        prisma.clockRecordHistory.deleteMany({ where: { staffId: id } }),
        prisma.clockRecord.deleteMany({ where: { staffId: id } }),
        prisma.shiftHistory.deleteMany({ where: { staffId: id } }),
        prisma.shift.deleteMany({ where: { staffId: id } }),
        prisma.monthlyEarningTarget.deleteMany({ where: { staffId: id } }),
        prisma.transferRequest.deleteMany({ where: { staffId: id } }),
        prisma.gameTitle.deleteMany({ where: { staffId: id } }),
        prisma.perfectAttendance.deleteMany({ where: { staffId: id } }),
        prisma.expense.deleteMany({ where: { staffId: id } }),
        prisma.workOrderStaff.updateMany({ where: { staffId: id }, data: { staffId: null } }),
        prisma.staff.delete({ where: { id } }),
      ]);
      deleted += 1;
    } catch {
      // 想定外の制約(未対応の関連テーブル等)で失敗した場合はスキップし、他は続行する。
    }
  }
  revalidatePath("/admin/staff");
  return { deleted, failed: staffIds.length - deleted };
}

function strOrNull(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v || null;
}

function intOrNull(formData: FormData, key: string): number | null {
  const v = String(formData.get(key) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function nonNegIntOrNull(formData: FormData, key: string): number | null {
  const n = intOrNull(formData, key);
  return n !== null && n >= 0 ? n : null;
}

export async function updateStaffDetails(staffId: string, formData: FormData) {
  await requireAdmin();
  const operatorName = operatorNameFrom(formData);
  const beforePay = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      paymentMethod: true, fixedClosingDay: true, fixedPaymentMonthOffset: true, fixedPaymentDay: true,
      payType: true, dailyRate: true, monthlyAmount: true, travelExpenseIncluded: true, dailyTravelInclTax: true,
    },
  });

  const birthDateRaw = String(formData.get("birthDate") ?? "").trim();
  const paymentMethod = String(formData.get("paymentMethod") ?? "REQUEST") as "FIXED" | "REQUEST";

  // 報酬設定(日当 / 月固定 / 交通費)。未選択なら null(従来どおりシフト単価を使う)
  const payTypeRaw = String(formData.get("payType") ?? "");
  const payType = payTypeRaw === "DAILY" || payTypeRaw === "MONTHLY" || payTypeRaw === "MANUAL" ? payTypeRaw : null;
  const dailyRate = payType === "DAILY" ? nonNegIntOrNull(formData, "dailyRate") : null;
  const monthlyAmount = payType === "MONTHLY" ? nonNegIntOrNull(formData, "monthlyAmount") : null;
  const travelRaw = String(formData.get("travelExpenseIncluded") ?? "");
  const travelExpenseIncluded = travelRaw === "true" ? true : travelRaw === "false" ? false : null;
  // 1日あたりの交通費(税込)。決まっている人だけ入力する(空欄=なし)。
  const dailyTravelInclTax = nonNegIntOrNull(formData, "dailyTravelInclTax");

  await prisma.staff.update({
    where: { id: staffId },
    data: {
      birthDate: birthDateRaw ? new Date(`${birthDateRaw}T00:00:00Z`) : null,
      phoneNumber: strOrNull(formData, "phoneNumber"),
      address: strOrNull(formData, "address"),
      invoiceRegistrationNumber: strOrNull(formData, "invoiceRegistrationNumber"),
      paymentMethod,
      fixedClosingDay: paymentMethod === "FIXED" ? intOrNull(formData, "fixedClosingDay") : null,
      fixedPaymentMonthOffset:
        paymentMethod === "FIXED" ? intOrNull(formData, "fixedPaymentMonthOffset") : null,
      fixedPaymentDay: paymentMethod === "FIXED" ? intOrNull(formData, "fixedPaymentDay") : null,
      payType,
      dailyRate,
      monthlyAmount,
      travelExpenseIncluded,
      dailyTravelInclTax,
      simpleMode: formData.get("simpleMode") === "on",
    },
  });

  // 金額に関わる設定が変わったときだけ、変更前 → 変更後を履歴に残す。
  if (beforePay) {
    const afterPay = {
      paymentMethod,
      fixedClosingDay: paymentMethod === "FIXED" ? intOrNull(formData, "fixedClosingDay") : null,
      fixedPaymentMonthOffset: paymentMethod === "FIXED" ? intOrNull(formData, "fixedPaymentMonthOffset") : null,
      fixedPaymentDay: paymentMethod === "FIXED" ? intOrNull(formData, "fixedPaymentDay") : null,
      payType,
      dailyRate,
      monthlyAmount,
      travelExpenseIncluded,
      dailyTravelInclTax,
    } as const;
    const changed = (Object.keys(afterPay) as (keyof typeof afterPay)[]).filter((k) => (beforePay[k] ?? null) !== (afterPay[k] ?? null));
    if (changed.length > 0) {
      await recordAudit({
        staffId,
        category: "AMOUNT_SETTING",
        action: "UPDATE_PAY_SETTINGS",
        summary: changed.map((k) => `${PAY_SETTING_LABELS[k]}: ${payFieldText(k, beforePay[k] ?? null)} → ${payFieldText(k, afterPay[k] ?? null)}`).join(" / "),
        before: Object.fromEntries(changed.map((k) => [k, beforePay[k] ?? null])),
        after: Object.fromEntries(changed.map((k) => [k, afterPay[k] ?? null])),
        actor: { type: "ADMIN", operatorName },
      });
    }
  }

  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${staffId}`);
  // 保存後に一覧を再取得した状態のページへ遷移させ、フォームの各項目
  // (支払方法など)が確実に最新の保存内容で再表示されるようにする。
  // (フォームがそのままだと defaultValue のみの input/select は再送信後も
  // 画面上は変更前の値のまま据え置かれてしまうため、遷移で作り直す。)
  redirect(`/admin/staff/${staffId}?saved=1`);
}
