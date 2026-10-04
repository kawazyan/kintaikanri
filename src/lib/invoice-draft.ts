import { prisma } from "@/lib/prisma";
import { addTax, computeInvoiceTotals, expenseLabel, travelLineLabel } from "@/lib/billing";
import { toJstDateValue } from "@/lib/time";

// 稼働明細書に載せるスナップショット(請求下書き作成時点の内容を Invoice.statement に保存する)。
export type StatementStaff = {
  name: string;
  places: string[]; // 稼働場所(店舗名)
  carriers: string[]; // キャリア
  dates: string[]; // 出勤した日(YYYY-MM-DD, 昇順)
  days: number; // 合計稼働日数
  // 交通費: NONE=請求しない(単価に込み等) / ACTUAL=スタッフ申請額で請求 / FLAT=クライアントへ一律請求
  travel: { mode: "NONE" | "ACTUAL" | "FLAT"; amountExTax: number; amountInclTax: number };
};

export type StatementSnapshot = {
  clientName: string;
  yearMonth: string;
  staff: StatementStaff[];
};

type DraftResult = { id: string; invoiceNumber: string };

// 請求下書きを作る(管理画面のボタンと、月初の自動作成の両方から使う)。
// 権限チェックは呼び出し側で行うこと。
export async function buildInvoiceDraft(clientId: string, yearMonth: string): Promise<DraftResult> {
  if (!clientId || !yearMonth) throw new Error("取引先と対象月は必須です。");

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
  if (!client) throw new Error("取引先が見つかりません。");

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
  const statementStaff: StatementStaff[] = [];
  const flatTravelLines: { staffName: string; amountExTax: number }[] = [];

  for (const order of orders) {
    for (const assignment of order.staffAssignments.filter((x) => x.active)) {
      if (!assignment.staffId || !assignment.staff) {
        throw new Error(`スタッフ「${assignment.requestedName}」が社内スタッフに紐付いていません。先に稼働依頼画面で紐付けてください。`);
      }

      // 出勤・退勤の両方が打刻されたシフトだけを稼働日として数える。
      const completedShifts = assignment.shifts.filter(
        (s) => s.clockRecords.some((r) => r.type === "IN") && s.clockRecords.some((r) => r.type === "OUT")
      );
      const completedDates = new Set<string>(completedShifts.map((s) => toJstDateValue(s.startTime)));
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

      // ---- 交通費の扱い(明細書用) ----
      // FLAT: 稼働が1日でもあれば、設定した月額をクライアントへ一律請求する(スタッフ申請額は請求しない)。
      // INCLUDED: 請求しない。SEPARATE/CONSULT: スタッフが申請して承認された交通費を請求する。
      let travel: StatementStaff["travel"] = { mode: "NONE", amountExTax: 0, amountInclTax: 0 };
      if (assignment.travelExpense === "FLAT") {
        const flat = assignment.flatTravelAmountExTax ?? 0;
        if (completedDates.size > 0 && flat > 0) {
          travel = { mode: "FLAT", amountExTax: flat, amountInclTax: addTax(flat).amountIncl };
          flatTravelLines.push({ staffName: assignment.staff.name, amountExTax: flat });
        }
      } else if (assignment.travelExpense !== "INCLUDED") {
        const actualExpenses = expenses
          .filter((e) => e.workOrderStaffId === assignment.id && e.category === "TRAVEL")
          .filter((e) => {
            // 日ごとの承認済み条件変更(込み/一律に変更された日)は請求対象から外す。
            const dateKey = toJstDateValue(e.expenseDate);
            const ov = approvedOverrideByDate.get(dateKey);
            const effective = ov?.changedTravelExpense ?? assignment.travelExpense;
            return effective !== "INCLUDED" && effective !== "FLAT";
          });
        const actual = actualExpenses.reduce((sum, e) => sum + e.amountExTax, 0);
        const actualIncl = actualExpenses.reduce((sum, e) => sum + e.amountTaxInclusive, 0);
        if (actual > 0) travel = { mode: "ACTUAL", amountExTax: actual, amountInclTax: actualIncl };
      }

      statementStaff.push({
        name: assignment.staff.name,
        places: [...new Set(completedShifts.map((s) => s.storeName))],
        carriers: [...new Set(completedShifts.map((s) => s.carrier))],
        dates: [...completedDates].sort(),
        days: completedDates.size,
        travel,
      });
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

  const assignmentById = new Map(orders.flatMap((o) => o.staffAssignments.map((a) => [a.id, a] as const)));
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
      // 「込み」は請求しない。「一律」は月額を別行で請求するのでスタッフ申請額は請求しない。
      // 「別」は請求。「要相談」はK.Jの経費承認をもって請求可とする。
      if (effectiveTravel === "INCLUDED" || effectiveTravel === "FLAT") continue;
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
      // 交通費は「交通費相当額（税込N円）」。計算は税別(税抜額＋消費税)。
      label: category === "TRAVEL" ? travelLineLabel(g.incl) : expenseLabel(category),
      description: null,
      unitPriceExTax: g.ex,
      quantity: 1,
      subtotalExTax: g.ex,
      taxAmount: g.tax,
      totalInclTax: g.incl,
    });
    sortOrder += 10;
  }

  // 一律交通費は、スタッフ別に1行ずつ請求する。
  for (const f of flatTravelLines) {
    const t = addTax(f.amountExTax);
    lines.push({
      sortOrder,
      itemType: "TRAVEL_FLAT",
      label: travelLineLabel(t.amountIncl),
      description: `一律／${f.staffName}`,
      unitPriceExTax: f.amountExTax,
      quantity: 1,
      subtotalExTax: f.amountExTax,
      taxAmount: t.tax,
      totalInclTax: t.amountIncl,
    });
    sortOrder += 10;
  }

  // 請求書テンプレートと同じ方式: 消費税 = 税抜合計 × 10% を切り捨て。
  const { subtotalExTax, taxAmount, totalInclTax } = computeInvoiceTotals(lines);
  const previous = await prisma.invoice.findFirst({
    where: { clientId, yearMonth },
    orderBy: { revision: "desc" },
    select: { revision: true },
  });
  const revision = (previous?.revision ?? 0) + 1;
  const invoiceNumber = `KJ-${yearMonth.replace("-", "")}-${Date.now().toString().slice(-6)}${revision > 1 ? `-R${revision}` : ""}`;

  const statement: StatementSnapshot = { clientName: client.name, yearMonth, staff: statementStaff };

  const invoice = await prisma.invoice.create({
    data: {
      clientId,
      yearMonth,
      invoiceNumber,
      revision,
      subtotalExTax,
      taxAmount,
      totalInclTax,
      statement,
      lines: { create: lines },
      workOrders: { create: orders.map((o) => ({ workOrderId: o.id })) },
    },
  });

  return { id: invoice.id, invoiceNumber };
}
