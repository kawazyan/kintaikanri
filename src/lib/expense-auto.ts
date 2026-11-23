import { prisma } from "@/lib/prisma";
import { splitInclusiveTax } from "@/lib/billing";
import { recordAudit, yenText } from "@/lib/audit";
import { currentJstYearMonth, jstMonthRange } from "@/lib/time";

// スタッフごとの経費の自動作成(StaffExpenseRule)。稼働月ごとに、承認済みの経費を自動で作る・更新する。
//   KM    : 稼働日(出勤の打刻があるシフト)の店名が storeMatch を含むとき、1日 片道km×2 を走ったものとして
//           月の合計km × ratePerKm円 を交通費(ガソリン代)にする。高速代・駐車場代は含まない(本人が申請)
//   FIXED : 毎月の固定の経費(label・amount)
// ・対象は「今月と先月」の稼働月(出勤日数が増えるたびに月末まで再計算される)
// ・その月の振込完了が記録された後・承認済みでなくなった行(却下など)は触らない
// ・店名がどのルールにも合わない稼働日があるときは、その日を除いて計算し、画面に警告を出す

export const AUTO_EXPENSE_REVIEWER = "自動計算(経費)";

const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const km1 = (n: number) => String(Math.round(n * 10) / 10);

export type ExpenseSyncResult = { created: number; updated: number; notes: string[] };

export async function syncAutoExpenses(now: Date = new Date()): Promise<ExpenseSyncResult> {
  const result: ExpenseSyncResult = { created: 0, updated: 0, notes: [] };
  const thisMonth = currentJstYearMonth(now);
  const months = [shiftMonth(thisMonth, -1), thisMonth];
  const rules = await prisma.staffExpenseRule.findMany({ orderBy: [{ staffId: "asc" }, { createdAt: "asc" }, { id: "asc" }] });
  if (!rules.length) return result;
  const staffIds = [...new Set(rules.map((r) => r.staffId))];
  const staffRows = await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } });
  const nameOf = new Map(staffRows.map((s) => [s.id, s.name.replace(/[\s　]+/g, " ")]));

  for (const staffId of staffIds) {
    for (const ym of months) {
      const mine = rules.filter((r) => r.staffId === staffId && r.fromMonth <= ym);
      if (!mine.length) continue;
      // その月の振込完了が記録されていれば触らない(記録の金額が変わらなくなるため)
      const done = await prisma.fixedPaymentCompletion.findUnique({ where: { staffId_closingYearMonth: { staffId, closingYearMonth: ym } }, select: { id: true } });
      if (done) continue;
      const [y, m] = ym.split("-").map(Number);
      const expenseDate = new Date(Date.UTC(y, m - 1, 1, 3, 0, 0)); // 既存の経費と同じ(月初の12時JST)

      // ---- ガソリン代(KM) ----
      const kmRules = mine.filter((r) => r.kind === "KM" && r.storeMatch && r.oneWayKm != null);
      if (kmRules.length) {
        const { start, end } = jstMonthRange(ym);
        const shifts = await prisma.shift.findMany({
          where: { staffId, cancelledAt: null, startTime: { gte: start, lt: end }, clockRecords: { some: { type: "IN" } } },
          select: { storeName: true },
        });
        const perStore = new Map<string, { km: number; days: number }>();
        let ratePerKm = 10;
        const unmatched: string[] = [];
        for (const sh of shifts) {
          const rule = kmRules.find((r) => (sh.storeName ?? "").includes(r.storeMatch!));
          if (!rule) { unmatched.push(sh.storeName ?? "(店名なし)"); continue; }
          ratePerKm = rule.ratePerKm;
          const key = sh.storeName ?? rule.storeMatch!;
          const cur = perStore.get(key) ?? { km: rule.oneWayKm! * 2, days: 0 };
          cur.days++;
          perStore.set(key, cur);
        }
        if (unmatched.length) result.notes.push(`${nameOf.get(staffId)}: ${Number(ym.slice(5))}月の稼働日のうち、店名がルールに合わない${unmatched.length}日分（${[...new Set(unmatched)].join("、")}）はガソリン代に入っていません`);
        if (perStore.size) {
          let totalKm = 0;
          const lines: string[] = [];
          for (const [store, v] of perStore) {
            const km = v.km * v.days;
            totalKm += km;
            lines.push(`${store} ${km1(v.km / 2)}km×2×${v.days}日=${km1(km)}km`);
          }
          const amount = Math.round(totalKm * ratePerKm);
          const description = `${y}年${m}月 ガソリン代（自動計算・1km${ratePerKm}円、自宅往復）\n${lines.join("\n")}\n合計${km1(totalKm)}km×${ratePerKm}円=${amount.toLocaleString("ja-JP")}円。高速代・駐車場代は含みません（本人が別に申請）。`;
          await upsertAuto({ staffId, ym, marker: "ガソリン代（自動計算", category: "TRAVEL", expenseDate, description, amount, now, staffName: nameOf.get(staffId) ?? "", result });
        }
      }

      // ---- 毎月の固定の経費(FIXED) ----
      for (const r of mine.filter((x) => x.kind === "FIXED" && x.label && x.amount != null)) {
        const description = `${y}年${m}月 ${r.label}（自動作成）`;
        await upsertAuto({ staffId, ym, marker: `${r.label}（自動作成）`, category: "OTHER", expenseDate, description, amount: r.amount!, now, staffName: nameOf.get(staffId) ?? "", result });
      }
    }
  }
  return result;
}

async function upsertAuto(a: {
  staffId: string; ym: string; marker: string; category: "TRAVEL" | "OTHER"; expenseDate: Date; description: string; amount: number; now: Date; staffName: string; result: ExpenseSyncResult;
}) {
  const rows = await prisma.expense.findMany({
    where: { staffId: a.staffId, yearMonth: a.ym, reviewerName: AUTO_EXPENSE_REVIEWER, description: { contains: a.marker } },
    select: { id: true, status: true, amountTaxInclusive: true, description: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const existing = rows[0] ?? null;
  const tax = splitInclusiveTax(a.amount, 10);
  if (!existing) {
    const created = await prisma.expense.create({
      data: {
        staffId: a.staffId, yearMonth: a.ym, expenseDate: a.expenseDate, category: a.category, description: a.description,
        amountTaxInclusive: a.amount, amountExTax: tax.amountEx, taxAmount: tax.tax, taxRate: 10,
        status: "APPROVED", submittedAt: a.now, reviewedAt: a.now, reviewerName: AUTO_EXPENSE_REVIEWER,
      },
      select: { id: true },
    });
    // 同時に2か所から作られたときの重複は、古い1件だけ残す
    const dup = await prisma.expense.findMany({
      where: { staffId: a.staffId, yearMonth: a.ym, reviewerName: AUTO_EXPENSE_REVIEWER, description: { contains: a.marker } },
      select: { id: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (dup.length > 1) {
      await prisma.expense.deleteMany({ where: { id: { in: dup.slice(1).map((d) => d.id) } } });
      if (dup[0].id !== created.id) return;
    }
    await recordAudit({
      staffId: a.staffId, category: "EXPENSE", action: "EXPENSE_AUTO_CREATED", yearMonth: a.ym,
      summary: `経費を自動作成（承認済み）: ${a.marker.replace("（自動計算", "").replace("（自動作成）", "")} ${yenText(a.amount)}`,
      after: { amount: a.amount }, actor: { type: "ADMIN", operatorName: AUTO_EXPENSE_REVIEWER },
    });
    a.result.created++;
  } else if (existing.status === "APPROVED" && (existing.amountTaxInclusive !== a.amount || existing.description !== a.description)) {
    const amountChanged = existing.amountTaxInclusive !== a.amount;
    await prisma.expense.update({
      where: { id: existing.id },
      data: { description: a.description, amountTaxInclusive: a.amount, amountExTax: tax.amountEx, taxAmount: tax.tax },
    });
    if (amountChanged) {
      await recordAudit({
        staffId: a.staffId, category: "EXPENSE", action: "EXPENSE_AUTO_UPDATED", yearMonth: a.ym,
        summary: `自動作成の経費を再計算: ${yenText(existing.amountTaxInclusive)} → ${yenText(a.amount)}`,
        before: { amount: existing.amountTaxInclusive }, after: { amount: a.amount }, actor: { type: "ADMIN", operatorName: AUTO_EXPENSE_REVIEWER },
      });
      a.result.updated++;
    }
  }
}
