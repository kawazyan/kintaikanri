"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addTax, expenseLabel } from "@/lib/billing";
import { toJstDateValue } from "@/lib/time";

export async function createInvoiceDraft(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId") || "");
  const yearMonth = String(formData.get("yearMonth") || "");
  if (!clientId || !yearMonth) throw new Error("取引先と対象月は必須です。");

  const orders = await prisma.workOrder.findMany({
    where: { clientId, yearMonth, status: { in: ["APPROVED", "CHANGES_PENDING", "TERMINATED"] } },
    include: {
      staffAssignments: {
        include: {
          staff: true,
          shifts: { where: { cancelledAt: null }, include: { clockRecords: true } },
          dailyOverrides: { where: { approvalStatus: "APPROVED" } },
        },
      },
    },
  });
  if (!orders.length) throw new Error("対象月の承認済み稼働依頼がありません。");

  const assignmentIds = orders.flatMap((o) => o.staffAssignments.map((a) => a.id));
  const expenses = await prisma.expense.findMany({
    where: { yearMonth, status: "APPROVED", workOrderStaffId: { in: assignmentIds } },
  });

  const serviceDetails: string[] = [];
  let serviceTotalExTax = 0;

  for (const order of orders) {
    for (const assignment of order.staffAssignments.filter((x) => x.active)) {
      if (!assignment.staffId || !assignment.staff) {
        throw new Error(`スタッフ「${assignment.requestedName}」が社内スタッフに紐付いていません。先に稼働依頼画面で紐付けてください。`);
      }

      const completedDates = new Set<string>(
        assignment.shifts
          .filter((s) => s.clockRecords.some((r) => r.type === "IN") && s.clockRecords.some((r) => r.type === "OUT"))
          .map((s) => toJstDateValue(s.startTime))
      );
      const approvedOverrideByDate = new Map(
        assignment.dailyOverrides.map((ov) => [toJstDateValue(ov.workDate), ov] as const)
      );

      let amountExTax = 0;
      if (assignment.contractType === "DAILY") {
        for (const dateKey of completedDates) {
          const override = approvedOverrideByDate.get(dateKey);
          amountExTax += override?.changedRateExTax ?? assignment.rateAmountExTax;
        }
      } else if (assignment.absenceDeduction === "YES") {
        const baseDaily = order.plannedDays > 0 ? Math.floor(assignment.rateAmountExTax / order.plannedDays) : 0;
        for (const dateKey of completedDates) {
          const override = approvedOverrideByDate.get(dateKey);
          amountExTax += override?.changedRateExTax ?? baseDaily;
        }
      } else {
        amountExTax = assignment.rateAmountExTax;
        // 月単価固定でも、承認済みの当日単価変更がある場合は日割り基準との差額だけ加算/減算する。
        const baseDaily = order.plannedDays > 0 ? Math.floor(assignment.rateAmountExTax / order.plannedDays) : 0;
        for (const [dateKey, override] of approvedOverrideByDate) {
          if (completedDates.has(dateKey) && override.changedRateExTax != null) {
            amountExTax += override.changedRateExTax - baseDaily;
          }
        }
      }

      serviceTotalExTax += amountExTax;
      serviceDetails.push(`${assignment.staff.name} / ${completedDates.size}日稼働`);
    }
  }

  const serviceTax = addTax(serviceTotalExTax);
  const lines: {
    sortOrder: number;
    itemType: string;
    label: string;
    description: string | null;
    unitPriceExTax: number;
    quantity: number;
    subtotalExTax: number;
    taxAmount: number;
    totalInclTax: number;
  }[] = [
    {
      sortOrder: 10,
      itemType: "SERVICE",
      label: "業務委託費一式",
      description: serviceDetails.join(" / "),
      unitPriceExTax: serviceTotalExTax,
      quantity: 1,
      subtotalExTax: serviceTotalExTax,
      taxAmount: serviceTax.tax,
      totalInclTax: serviceTax.amountIncl,
    },
  ];

  const assignmentById = new Map(
    orders.flatMap((o) => o.staffAssignments.map((a) => [a.id, a] as const))
  );
  const expenseGroups = new Map<string, { ex: number; tax: number; incl: number }>();

  for (const e of expenses) {
    const assignment = e.workOrderStaffId ? assignmentById.get(e.workOrderStaffId) : null;
    if (!assignment) continue;

    if (e.category === "TRAVEL") {
      const dateKey = toJstDateValue(e.expenseDate);
      const dayOverride = assignment.dailyOverrides.find(
        (ov) => toJstDateValue(ov.workDate) === dateKey && ov.approvalStatus === "APPROVED"
      );
      const effectiveTravel = dayOverride?.changedTravelExpense ?? assignment.travelExpense;
      // 「込み」は原則請求しない。「別」は請求。「要相談」はK.Jの経費承認をもって請求可とする。
      if (effectiveTravel === "INCLUDED") continue;
    }

    const g = expenseGroups.get(e.category) ?? { ex: 0, tax: 0, incl: 0 };
    g.ex += e.amountExTax;
    g.tax += e.taxAmount;
    g.incl += e.amountTaxInclusive;
    expenseGroups.set(e.category, g);
  }

  let sortOrder = 20;
  for (const [category, g] of expenseGroups) {
    lines.push({
      sortOrder,
      itemType: category,
      label: expenseLabel(category),
      description: null,
      unitPriceExTax: g.ex,
      quantity: 1,
      subtotalExTax: g.ex,
      taxAmount: g.tax,
      totalInclTax: g.incl,
    });
    sortOrder += 10;
  }

  const subtotalExTax = lines.reduce((sum, x) => sum + x.subtotalExTax, 0);
  const taxAmount = lines.reduce((sum, x) => sum + x.taxAmount, 0);
  const totalInclTax = lines.reduce((sum, x) => sum + x.totalInclTax, 0);
  const previous = await prisma.invoice.findFirst({ where: { clientId, yearMonth }, orderBy: { revision: "desc" }, select: { revision: true } });
  const revision = (previous?.revision ?? 0) + 1;
  const invoiceNumber = `KJ-${yearMonth.replace("-", "")}-${Date.now().toString().slice(-6)}${revision > 1 ? `-R${revision}` : ""}`;

  const invoice = await prisma.invoice.create({
    data: {
      clientId,
      yearMonth,
      invoiceNumber,
      revision,
      subtotalExTax,
      taxAmount,
      totalInclTax,
      lines: { create: lines },
      workOrders: { create: orders.map((o) => ({ workOrderId: o.id })) },
    },
  });

  revalidatePath("/admin/invoices");
  return invoice.id;
}

export async function finalizeInvoice(id: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("finalizedBy") || "").trim();
  if (!name) throw new Error("請求確定者名は必須です。");
  const current = await prisma.invoice.findUnique({ where: { id }, select: { revision: true } });
  if (!current) throw new Error("請求書が見つかりません。");
  await prisma.invoice.update({
    where: { id },
    data: { status: current.revision > 1 ? "REISSUED" : "FINALIZED", finalizedAt: new Date(), finalizedBy: name },
  });
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath("/admin/invoices");
}
