import { prisma } from "@/lib/prisma";
import { addTax, computeInvoiceTotals, expenseLabel } from "@/lib/billing";
import { toJstDateValue } from "@/lib/time";

// 稼働明細書に載せるスナップショット(請求下書き作成時点の内容を Invoice.statement に保存する)。
// 請求書は「業務委託費一式」の1行だけ。計算方法と内訳はすべてこの明細書に書く。
export type StatementExtra = { label: string; amountExTax: number; amountInclTax: number };

export type StatementStaff = {
  name: string;
  places: string[]; // 稼働場所(店舗名)
  carriers: string[]; // キャリア
  dates: string[]; // 出勤した日(YYYY-MM-DD, 昇順)
  days: number; // 合計稼働日数
  serviceExTax: number; // 業務委託費(税抜)
  serviceCalc: string; // 業務委託費の計算方法(例: 日額 ¥20,000 × 3日)
  // 交通費: NONE=請求しない(単価に込み等) / ACTUAL=スタッフ申請額で請求 / FLAT=クライアントへ一律請求
  travel: { mode: "NONE" | "ACTUAL" | "FLAT"; amountExTax: number; amountInclTax: number };
  extras?: StatementExtra[]; // 宿泊費・その他経費のうちクライアントへ請求するもの
};

export type StatementSnapshot = {
  clientName: string;
  yearMonth: string;
  staff: StatementStaff[];
};

// スタッフ1人ぶんの請求対象(税抜)。請求書の「業務委託費一式」の内訳の合計になる。
export function staffBillableExTax(s: StatementStaff) {
  return (
    (s.serviceExTax ?? 0) +
    s.travel.amountExTax +
    (s.extras ?? []).reduce((sum, e) => sum + e.amountExTax, 0)
  );
}

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

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

  const statementStaff: StatementStaff[] = [];

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
      const hasRateOverride = [...completedDates].some(
        (d) => approvedOverrideByDate.get(d)?.changedRateExTax != null
      );
      const days = completedDates.size;
      const baseDaily = order.plannedDays > 0 ? Math.floor(assignment.rateAmountExTax / order.plannedDays) : 0;

      let amountExTax = 0;
      let calc = "";
      if (assignment.contractType === "DAILY") {
        for (const dateKey of completedDates) {
          const override = approvedOverrideByDate.get(dateKey);
          amountExTax += override?.changedRateExTax ?? assignment.rateAmountExTax;
        }
        calc = `日額 ${yen(assignment.rateAmountExTax)} × ${days}日`;
      } else if (assignment.absenceDeduction === "YES") {
        for (const dateKey of completedDates) {
          const override = approvedOverrideByDate.get(dateKey);
          amountExTax += override?.changedRateExTax ?? baseDaily;
        }
        calc = `月額 ${yen(assignment.rateAmountExTax)} ÷ 予定${order.plannedDays}日 = 1日 ${yen(baseDaily)} × ${days}日`;
      } else {
        amountExTax = assignment.rateAmountExTax;
        // 月単価固定でも、承認済みの当日単価変更がある場合は日割り基準との差額だけ加算/減算する。
        for (const [dateKey, override] of approvedOverrideByDate) {
          if (completedDates.has(dateKey) && override.changedRateExTax != null) {
            amountExTax += override.changedRateExTax - baseDaily;
          }
        }
        calc = `月額 ${yen(assignment.rateAmountExTax)}（固定）`;
      }
      if (hasRateOverride) calc += "（承認済みの当日単価変更を含む）";

      // ---- 交通費の扱い ----
      // FLAT: 稼働が1日でもあれば、設定した月額をクライアントへ一律請求する(スタッフ申請額は請求しない)。
      // INCLUDED: 請求しない。SEPARATE/CONSULT: スタッフが申請して承認された交通費を請求する。
      // すべて税別計算(税抜額＋消費税)。例: 税込1,100円 → 1,000円＋税。
      let travel: StatementStaff["travel"] = { mode: "NONE", amountExTax: 0, amountInclTax: 0 };
      if (assignment.travelExpense === "FLAT") {
        const flat = assignment.flatTravelAmountExTax ?? 0;
        if (days > 0 && flat > 0) {
          travel = { mode: "FLAT", amountExTax: flat, amountInclTax: addTax(flat).amountIncl };
        }
      } else if (assignment.travelExpense !== "INCLUDED") {
        const actualExpenses = expenses
          .filter((e) => e.workOrderStaffId === assignment.id && e.category === "TRAVEL")
          .filter((e) => {
            // 日ごとの承認済み条件変更(込み/一律に変更された日)は請求対象から外す。
            const ov = approvedOverrideByDate.get(toJstDateValue(e.expenseDate));
            const effective = ov?.changedTravelExpense ?? assignment.travelExpense;
            return effective !== "INCLUDED" && effective !== "FLAT";
          });
        const ex = actualExpenses.reduce((sum, e) => sum + e.amountExTax, 0);
        const incl = actualExpenses.reduce((sum, e) => sum + e.amountTaxInclusive, 0);
        if (ex > 0) travel = { mode: "ACTUAL", amountExTax: ex, amountInclTax: incl };
      }

      // 宿泊費・その他経費(承認済み)もクライアントへ請求する分は内訳に載せる。
      const extraMap = new Map<string, { ex: number; incl: number }>();
      for (const e of expenses) {
        if (e.workOrderStaffId !== assignment.id || e.category === "TRAVEL") continue;
        const g = extraMap.get(e.category) ?? { ex: 0, incl: 0 };
        g.ex += e.amountExTax;
        g.incl += e.amountTaxInclusive;
        extraMap.set(e.category, g);
      }
      const extras: StatementExtra[] = [...extraMap].map(([category, g]) => ({
        label: `${expenseLabel(category)}（税込${g.incl}円）`,
        amountExTax: g.ex,
        amountInclTax: g.incl,
      }));

      statementStaff.push({
        name: assignment.staff.name,
        places: [...new Set(completedShifts.map((s) => s.storeName))],
        carriers: [...new Set(completedShifts.map((s) => s.carrier))],
        dates: [...completedDates].sort(),
        days,
        serviceExTax: amountExTax,
        serviceCalc: calc,
        travel,
        extras,
      });
    }
  }

  // 請求書は「業務委託費一式」の1行だけ。交通費相当額なども含めた税抜合計を単価にする。
  const unitPrice = statementStaff.reduce((sum, s) => sum + staffBillableExTax(s), 0);
  const t = addTax(unitPrice);
  const lines = [
    {
      sortOrder: 10,
      itemType: "SERVICE",
      label: "業務委託費一式",
      description: "内訳は別紙「稼働明細書」のとおり",
      unitPriceExTax: unitPrice,
      quantity: 1,
      subtotalExTax: unitPrice,
      taxAmount: t.tax,
      totalInclTax: t.amountIncl,
    },
  ];

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
