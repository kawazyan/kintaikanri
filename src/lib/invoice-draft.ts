import { prisma } from "@/lib/prisma";
import { addTax, computeInvoiceTotals, expenseLabel } from "@/lib/billing";
import { jstMonthRange, toJstDateValue } from "@/lib/time";
import { unifyStoreNames, withShopSuffix } from "@/lib/store-names";
import { activeShiftRules, normName, ruleMatchesShift, type BillingTerms, type TravelByStore } from "@/lib/billing-terms";
import { syncWorkOrderShiftLinks } from "@/lib/work-order-linking";
import { fetchEventAds } from "@/lib/event-ads";
import { loadRuleIndex } from "@/lib/client-shifts";

// 稼働明細書に載せるスナップショット(請求下書き作成時点の内容を Invoice.statement に保存する)。
// 請求書は「業務委託費一式」の1行だけ。計算方法と内訳はすべてこの明細書に書く。
// store/period は広告費(K.J EVENT)の行だけ持つ。あれば明細書で「イベント主催店舗／イベント開催期間」の表にする。
export type StatementExtra = { label: string; amountExTax: number; amountInclTax: number; calc?: string; store?: string; period?: string };


export type StatementStaff = {
  name: string;
  places: string[]; // 稼働場所(店舗名)
  carriers: string[]; // キャリア
  dates: string[]; // 出勤した日(YYYY-MM-DD, 昇順)
  dayPlaces?: Record<string, string>; // 出勤した日(YYYY-MM-DD) → その日の稼働店舗
  days: number; // 合計稼働日数
  serviceExTax: number; // 業務委託費(税抜)
  serviceCalc: string; // 業務委託費の計算方法(例: 日額 ¥20,000 × 3日)
  // 交通費: NONE=請求しない(単価に込み等) / ACTUAL=スタッフ申請額で請求 / FLAT=クライアントへ一律請求
  // PER_DAY=取引先との取り決めで稼働日×店舗ごとに計算
  travel: { mode: "NONE" | "ACTUAL" | "FLAT" | "PER_DAY"; amountExTax: number; amountInclTax: number; calc?: string; lines?: { label: string; calc: string; amountExTax: number }[] };
  extras?: StatementExtra[]; // 宿泊費・その他経費のうちクライアントへ請求するもの
};

export type StatementSnapshot = {
  clientName: string;
  yearMonth: string;
  staff: StatementStaff[];
  // スタッフに紐付かない取引先全体の項目(新幹線代・広告原価・商材仕入れ代原価など)
  clientExtras?: StatementExtra[];
  warnings?: string[]; // 下書き作成時の注意(画面にだけ表示。PDFには載せない)
};

// 請求書の「業務委託費一式」(税抜)= 全スタッフ分 + 取引先全体の項目
export function statementBillableExTax(d: Pick<StatementSnapshot, "staff" | "clientExtras">) {
  return (
    d.staff.reduce((sum, s) => sum + staffBillableExTax(s), 0) +
    (d.clientExtras ?? []).reduce((sum, e) => sum + e.amountExTax, 0)
  );
}

// スタッフ1人ぶんの請求対象(税抜)。請求書の「業務委託費一式」の内訳の合計になる。
export function staffBillableExTax(s: StatementStaff) {
  return (
    (s.serviceExTax ?? 0) +
    s.travel.amountExTax +
    (s.extras ?? []).reduce((sum, e) => sum + e.amountExTax, 0)
  );
}

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

// 稼働日ごとの店舗から、店舗別の往復交通費を計算する。取り決めのない店舗は0円にして警告を返す。
function perStoreTravel(rules: TravelByStore[], dayStore: Map<string, string>, staffName: string) {
  const counts = new Map<number, number>();
  const unmatched = new Set<string>();
  for (const [, store] of dayStore) {
    const idx = rules.findIndex((r) => store.includes(r.match));
    if (idx < 0) unmatched.add(store);
    else counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  const parts: string[] = [];
  const lines: { label: string; calc: string; amountExTax: number }[] = [];
  let ex = 0;
  for (const [idx, n] of [...counts].sort((a, b) => a[0] - b[0])) {
    const r = rules[idx];
    ex += r.perDayExTax * n;
    parts.push(`${r.match} ${yen(r.perDayExTax)}（${r.detail}）× ${n}日`);
    lines.push({ label: `交通費相当額\n${r.match}`, calc: `${yen(r.perDayExTax)} × ${n}日\n（${r.detail}）`, amountExTax: r.perDayExTax * n });
  }
  const warning = unmatched.size
    ? `${staffName}さんの稼働店舗「${[...unmatched].join("、")}」は交通費の取り決めがないため、交通費を0円で作成しました。必要なら修正画面で入力してください。`
    : null;
  const travel: StatementStaff["travel"] =
    ex > 0
      ? { mode: "PER_DAY", amountExTax: ex, amountInclTax: addTax(ex).amountIncl, calc: `${parts.join(" ＋ ")} ＝ ${yen(ex)}＋税で計算`, lines }
      : { mode: "NONE", amountExTax: 0, amountInclTax: 0 };
  return { travel, warning };
}

type DraftResult = { id: string; invoiceNumber: string };

// 請求下書きを作る(管理画面のボタンと、月初の自動作成の両方から使う)。
// 権限チェックは呼び出し側で行うこと。
export async function buildInvoiceDraft(clientId: string, yearMonth: string): Promise<DraftResult> {
  if (!clientId || !yearMonth) throw new Error("取引先と対象月は必須です。");

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true, billingTerms: true } });
  if (!client) throw new Error("取引先が見つかりません。");

  const billableWhere = { clientId, yearMonth, status: { in: ["APPROVED", "CHANGES_PENDING", "TERMINATED"] as ("APPROVED" | "CHANGES_PENDING" | "TERMINATED")[] } };
  // 稼働依頼に紐付いていないシフトは請求に入らないため、先に紐付けを同期する
  // (管理画面・取引先の状況確認ページを開いたときと同じ処理。紐付け済みには影響しない)。
  const targetIds = await prisma.workOrder.findMany({ where: billableWhere, select: { id: true } });
  for (const t of targetIds) await syncWorkOrderShiftLinks(t.id);

  const orders = await prisma.workOrder.findMany({
    where: billableWhere,
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

  const assignmentIds = orders.flatMap((o) => o.staffAssignments.map((a) => a.id));
  const expenses = await prisma.expense.findMany({
    where: { yearMonth, status: "APPROVED", workOrderStaffId: { in: assignmentIds } },
  });

  const terms = (client.billingTerms ?? {}) as BillingTerms;
  const statementStaff: StatementStaff[] = [];
  const warnings: string[] = [];

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
      // 欠勤控除の日割りの基準は、当月に登録されたシフトの日数(キャンセル除く)。登録が無いときだけ依頼の予定日数を使う。
      const plannedDays = new Set(assignment.shifts.map((s) => toJstDateValue(s.startTime))).size || order.plannedDays;
      const baseDaily = plannedDays > 0 ? Math.floor(assignment.rateAmountExTax / plannedDays) : 0;

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
        calc = `月額 ${yen(assignment.rateAmountExTax)} ÷ 予定${plannedDays}日 = 1日 ${yen(baseDaily)} × ${days}日`;
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
      if (terms.travelByStore?.length) {
        // 取引先との取り決め: 稼働日ごとに、その日の店舗に合う往復交通費を加算する。
        const dayStore = new Map<string, string>();
        for (const sh of completedShifts) dayStore.set(toJstDateValue(sh.startTime), sh.storeName);
        const r = perStoreTravel(terms.travelByStore, dayStore, assignment.staff.name);
        if (r.warning) warnings.push(r.warning);
        travel = r.travel;
      } else if (assignment.travelExpense === "FLAT") {
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

      const uni = ((m) => (n: string) => (terms.shopSuffix ? withShopSuffix(m.get(n) ?? n) : (m.get(n) ?? n)))(unifyStoreNames(completedShifts.map((s) => s.storeName)));
      statementStaff.push({
        name: assignment.staff.name,
        places: [...new Set(completedShifts.map((s) => uni(s.storeName)))],
        carriers: terms.carriers?.length ? terms.carriers : [...new Set(completedShifts.map((s) => s.carrier))],
        dates: [...completedDates].sort(),
        dayPlaces: Object.fromEntries(completedShifts.map((sh) => [toJstDateValue(sh.startTime), uni(sh.storeName)])),
        days,
        serviceExTax: amountExTax,
        serviceCalc: calc,
        travel,
        extras,
      });
    }
  }

  // ---- シフトからの請求(稼働依頼がなくてもよい) ----
  // ルールに合う「未紐付け」の完了シフトを、スタッフごとに集計する。
  const rules = activeShiftRules(terms, yearMonth);
  const conflicted = new Set<string>();
  if (rules.length) {
    const { start, end } = jstMonthRange(yearMonth);
    const allStaff = await prisma.staff.findMany({ select: { id: true, name: true } });
    const used = new Set<string>();
    const ruleIndex = await loadRuleIndex(yearMonth);
    for (const rule of rules) {
      const person = allStaff.find((x) => normName(x.name) === normName(rule.staffName));
      if (!person) {
        warnings.push(`請求ルールのスタッフ「${rule.staffName}」が見つかりません。`);
        continue;
      }
      const shifts = await prisma.shift.findMany({
        where: { staffId: person.id, workOrderStaffId: null, cancelledAt: null, startTime: { gte: start, lt: end } },
        include: { clockRecords: true },
        orderBy: { startTime: "asc" },
      });
      const done = shifts.filter(
        (s) =>
          !used.has(s.id) &&
          s.clockRecords.some((r) => r.type === "IN") &&
          s.clockRecords.some((r) => r.type === "OUT") &&
          ruleMatchesShift(rule, person.name, s.storeName, toJstDateValue(s.startTime)) &&
          // 2社以上の契約に当てはまるシフトは、二重に請求しないよう含めない(下で警告を出す)
          (ruleIndex.owners(person.name, s.storeName, toJstDateValue(s.startTime)).length === 1 ||
            (conflicted.add(`${person.name} ${toJstDateValue(s.startTime)} ${s.storeName}`), false))
      );
      done.forEach((s) => used.add(s.id));
      const dayStore = new Map<string, string>();
      for (const s of done) dayStore.set(toJstDateValue(s.startTime), s.storeName);
      const dates = [...dayStore.keys()].sort();
      if (!dates.length) continue;

      // 欠勤控除の日割りの基準は、当月に登録されたシフトの日数(キャンセル除く)。登録が無いときだけ契約の予定日数を使う。
      const registeredDays = new Set(
        shifts
          .filter((s) => !used.has(s.id) || done.some((d) => d.id === s.id))
          .filter((s) => ruleMatchesShift(rule, person.name, s.storeName, toJstDateValue(s.startTime)))
          .filter((s) => ruleIndex.owners(person.name, s.storeName, toJstDateValue(s.startTime)).length === 1)
          .map((s) => toJstDateValue(s.startTime))
      ).size;
      const plannedDays = registeredDays || (rule.plannedDays ?? 0);
      const deduct = rule.contract === "MONTHLY" && rule.absenceDeduction === "YES" && plannedDays > 0;
      const baseDaily = deduct ? Math.floor(rule.rateExTax / plannedDays) : 0;
      const service = rule.contract === "DAILY" ? rule.rateExTax * dates.length : deduct ? baseDaily * dates.length : rule.rateExTax;
      const serviceCalc =
        rule.contract === "DAILY"
          ? `日額 ${yen(rule.rateExTax)} × ${dates.length}日${rule.note ? `（${rule.note}）` : ""}`
          : deduct
            ? `月額 ${yen(rule.rateExTax)} ÷ 予定${plannedDays}日 = 1日 ${yen(baseDaily)} × ${dates.length}日${rule.note ? `（${rule.note}）` : ""}`
            : `月額 ${yen(rule.rateExTax)}（固定${rule.note ? `・${rule.note}` : ""}）`;

      let travel: StatementStaff["travel"] = { mode: "NONE", amountExTax: 0, amountInclTax: 0 };
      const storeRules = rule.travelByStore ?? terms.travelByStore;
      if (rule.flatTravelExTax) {
        travel = { mode: "FLAT", amountExTax: rule.flatTravelExTax, amountInclTax: addTax(rule.flatTravelExTax).amountIncl };
      } else if (storeRules?.length) {
        const r = perStoreTravel(storeRules, dayStore, person.name);
        if (r.warning) warnings.push(r.warning);
        travel = r.travel;
      }
      // 新幹線代など、月ごとの固定の交通費をこのスタッフの交通費に足す
      if (rule.extraTravel?.length) {
        const add = rule.extraTravel.reduce((a, e) => a + e.amountExTax, 0);
        const total = travel.amountExTax + add;
        const parts = [travel.calc ? travel.calc.replace(/ ＝ [^＝]*$/, "") : "", ...rule.extraTravel.map((e) => `${e.label} ${e.calc}`)].filter(Boolean);
        travel = {
          mode: travel.mode === "NONE" ? "FLAT" : travel.mode,
          amountExTax: total,
          amountInclTax: addTax(total).amountIncl,
          calc: `${parts.join(" ＋ ")} ＝ ${yen(total)}＋税で計算`,
          lines: [
            ...(travel.lines ?? (travel.amountExTax > 0 ? [{ label: "交通費相当額", calc: travel.calc ?? "", amountExTax: travel.amountExTax }] : [])),
            ...rule.extraTravel.map((e) => ({ label: `交通費相当額\n${e.label}`, calc: e.calc, amountExTax: e.amountExTax })),
          ],
        };
      }

      const uni = ((m) => (n: string) => (terms.shopSuffix ? withShopSuffix(m.get(n) ?? n) : (m.get(n) ?? n)))(unifyStoreNames(done.map((s) => s.storeName)));
      statementStaff.push({
        name: person.name,
        places: [...new Set(done.map((s) => uni(s.storeName)))],
        carriers: terms.carriers?.length ? terms.carriers : [...new Set(done.map((s) => s.carrier))],
        dates,
        dayPlaces: Object.fromEntries([...dayStore].map(([d, n]) => [d, uni(n)])),
        days: dates.length,
        serviceExTax: service,
        serviceCalc,
        travel,
        extras: [],
      });
    }
  }
  if (conflicted.size) warnings.push(`次のシフトは2社以上の契約に当てはまるため、請求に含めていません。契約の店舗名を見直してください: ${[...conflicted].slice(0, 8).join(" / ")}`);
  if (!orders.length && !statementStaff.length) {
    throw new Error("対象月の承認済み稼働依頼も、シフトからの請求ルールに合う稼働実績もありません。");
  }

  // スタッフをまたいで、同じ店舗の表記ゆれ(例: 「西多賀店」と「auショップ西多賀店」)を統一する。
  {
    const m = unifyStoreNames(statementStaff.flatMap((s) => [...s.places, ...Object.values(s.dayPlaces ?? {})]));
    for (const s of statementStaff) {
      s.places = [...new Set(s.places.map((n) => m.get(n) ?? n))];
      if (s.dayPlaces) s.dayPlaces = Object.fromEntries(Object.entries(s.dayPlaces).map(([d, n]) => [d, m.get(n) ?? n]));
    }
  }

  // 取引先全体の固定加算(新幹線代など)。稼働が1日でもある月だけ載せる。
  const clientExtras: StatementExtra[] = [];
  if (statementStaff.some((s) => s.days > 0)) {
    // 従来の固定項目
    for (const e of terms.monthlyExtras ?? []) {
      clientExtras.push({ label: e.label, amountExTax: e.amountExTax, amountInclTax: addTax(e.amountExTax).amountIncl, calc: e.calc });
    }

    // K.J EVENT からの広告費取得
    // 失敗時は例外のまま(広告費が抜けた請求書を作らないため)
    const eventAgencyId = (terms as { eventAgencyId?: string }).eventAgencyId;
    if (eventAgencyId) {
      for (const ad of await fetchEventAds(eventAgencyId, yearMonth, !!terms.shopSuffix)) clientExtras.push(ad);
    }
  }

  // 請求書は「業務委託費一式」の1行だけ。交通費相当額なども含めた税抜合計を単価にする。
  const unitPrice = statementBillableExTax({ staff: statementStaff, clientExtras });
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

  const statement: StatementSnapshot = { clientName: client.name, yearMonth, staff: statementStaff, clientExtras, warnings };

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
