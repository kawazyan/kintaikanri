import { prisma } from "@/lib/prisma";
import { addTax, computeInvoiceTotals, expenseLabel, splitInclusiveTax } from "@/lib/billing";
import { jstDayRange, jstMonthRange, toJstDateValue } from "@/lib/time";
import { unifyStoreNames, withShopSuffix } from "@/lib/store-names";
import { activeShiftRules, normName, ruleMatchesShift, type BillingTerms, type ShiftBillingRule, type TravelByStore } from "@/lib/billing-terms";
import { syncWorkOrderShiftLinks } from "@/lib/work-order-linking";
import { fetchEventAds } from "@/lib/event-ads";
import { loadRuleIndex, type RuleIndex } from "@/lib/client-shifts";
import { mergeCarryOver } from "@/lib/invoice-carryover";

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
  // 請求書の画面で「スタッフを追加」したスタッフの条件。承認すると、この内容で取引先の契約に自動登録する。
  manual?: ManualStaffInfo;
};

// 追加スタッフの条件(請求書に書いた内容が正)。rateExTax は欠勤控除する前の月額(税抜)。
export type ManualStaffInput = { storeName: string; rateExTax: number; absenceDeduction: "YES" | "NO" };
export type ManualStaffInfo = ManualStaffInput & { plannedDays: number };

// 下書き作成時の自動計算結果(修正を引き継ぐとき、「手で直した項目」を見分けるための元の値)。
export type StatementBaseline = {
  staff: Pick<StatementStaff, "name" | "dates" | "dayPlaces" | "serviceExTax" | "serviceCalc" | "travel">[];
  clientExtras: StatementExtra[];
};

export type StatementSnapshot = {
  clientName: string;
  yearMonth: string;
  staff: StatementStaff[];
  // スタッフに紐付かない取引先全体の項目(新幹線代・広告原価・商材仕入れ代原価など)
  clientExtras?: StatementExtra[];
  warnings?: string[]; // 下書き作成時の注意(画面にだけ表示。PDFには載せない)
  baseline?: StatementBaseline;
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

// 1日あたりの交通費(税込)が決まっているスタッフの交通費。月の合計(日額 × 稼働日数)を税込として、税抜に直す。
function dailyTravelFor(dailyInclTax: number | null | undefined, days: number): StatementStaff["travel"] | null {
  if (!dailyInclTax || dailyInclTax <= 0 || days <= 0) return null;
  const incl = dailyInclTax * days;
  const ex = splitInclusiveTax(incl).amountEx;
  const calc = `${yen(dailyInclTax)}（税込） × ${days}日 ＝ ${yen(incl)}（税込）`;
  return { mode: "PER_DAY", amountExTax: ex, amountInclTax: incl, calc, lines: [{ label: "交通費相当額", calc, amountExTax: ex }] };
}

// 稼働日として数えるシフト。出勤・退勤の両方が打刻されたもの。
// 退勤の打刻漏れは稼働したものとして扱う(出勤だけ打刻され、その日(JST)が終わっていれば稼働)。スタッフへの支払い(earnings.ts)と同じ判定。
function isWorkedShift(s: { startTime: Date; clockRecords: { type: string }[] }, now: Date = new Date()) {
  const hasIn = s.clockRecords.some((r) => r.type === "IN");
  const hasOut = s.clockRecords.some((r) => r.type === "OUT");
  return hasIn && (hasOut || now >= jstDayRange(s.startTime).end);
}

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

type RuleCtx = {
  terms: BillingTerms;
  yearMonth: string;
  allStaff: { id: string; name: string; dailyTravelInclTax: number | null }[];
  ruleIndex: RuleIndex;
  used: Set<string>;
  conflicted: Set<string>;
  warnings: string[];
};

async function makeRuleCtx(terms: BillingTerms, yearMonth: string, warnings: string[]): Promise<RuleCtx> {
  const allStaff = await prisma.staff.findMany({ select: { id: true, name: true, dailyTravelInclTax: true } });
  return { terms, yearMonth, allStaff, ruleIndex: await loadRuleIndex(yearMonth), used: new Set(), conflicted: new Set(), warnings };
}

// 契約(シフトからの請求ルール)1件ぶんのスタッフ明細を作る。該当する稼働がなければ null。
// manual を渡すと「請求書で追加したスタッフ」として計算する: 店舗名は問わず、どの取引先の契約にも当てはまらないシフトだけを数え、店舗名は入力値に統一する。
async function staffFromRule(ctx: RuleCtx, rule: ShiftBillingRule, manual?: ManualStaffInput): Promise<StatementStaff | null> {
  const { terms, yearMonth, allStaff, ruleIndex, used, conflicted, warnings } = ctx;
  const { start, end } = jstMonthRange(yearMonth);
  const person = allStaff.find((x) => normName(x.name) === normName(rule.staffName));
  if (!person) {
    warnings.push(`請求ルールのスタッフ「${rule.staffName}」が見つかりません。`);
    return null;
  }
  const matchRule: ShiftBillingRule = manual ? { ...rule, storeMatch: undefined } : rule;
  const ownerOk = (n: number) => (manual ? n === 0 : n === 1);
  const shifts = await prisma.shift.findMany({
    where: { staffId: person.id, workOrderStaffId: null, cancelledAt: null, startTime: { gte: start, lt: end } },
    include: { clockRecords: true },
    orderBy: { startTime: "asc" },
  });
  const done = shifts.filter(
    (s) =>
      !used.has(s.id) &&
      isWorkedShift(s) &&
      ruleMatchesShift(matchRule, person.name, s.storeName, toJstDateValue(s.startTime)) &&
      // 2社以上の契約に当てはまるシフトは、二重に請求しないよう含めない(下で警告を出す)
      (ownerOk(ruleIndex.owners(person.name, s.storeName, toJstDateValue(s.startTime)).length) ||
        (!manual && (conflicted.add(`${person.name} ${toJstDateValue(s.startTime)} ${s.storeName}`), false)))
  );
  done.forEach((s) => used.add(s.id));
  const dayStore = new Map<string, string>();
  for (const s of done) dayStore.set(toJstDateValue(s.startTime), s.storeName);
  const dates = [...dayStore.keys()].sort();
  if (!dates.length) return null;

  // 欠勤控除の日割りの基準は、当月に登録されたシフトの日数(キャンセル除く)。登録が無いときだけ契約の予定日数を使う。
  const registeredDays = new Set(
    shifts
      .filter((s) => !used.has(s.id) || done.some((d) => d.id === s.id))
      .filter((s) => ruleMatchesShift(matchRule, person.name, s.storeName, toJstDateValue(s.startTime)))
      .filter((s) => ownerOk(ruleIndex.owners(person.name, s.storeName, toJstDateValue(s.startTime)).length))
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
  // スタッフに「1日あたりの交通費」が決まっている場合は、それを優先する(稼働日数 × 日額)。
  const fixedDailyTravel = dailyTravelFor(person.dailyTravelInclTax, dates.length);
  if (fixedDailyTravel) travel = fixedDailyTravel;
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

  const uni: (n: string) => string = manual
    ? ((p) => () => p)(terms.shopSuffix ? withShopSuffix(manual.storeName) : manual.storeName)
    : ((m) => (n: string) => (terms.shopSuffix ? withShopSuffix(m.get(n) ?? n) : (m.get(n) ?? n)))(unifyStoreNames(done.map((s) => s.storeName)));
  return {
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
    ...(manual ? { manual: { storeName: manual.storeName, rateExTax: manual.rateExTax, absenceDeduction: manual.absenceDeduction, plannedDays } } : {}),
  };
}

// 請求書の画面で「スタッフを追加」するときの、そのスタッフ1人ぶんの明細。該当する稼働がなければ staff は null。
export async function computeManualStaff(clientId: string, yearMonth: string, staffName: string, manual: ManualStaffInput) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { billingTerms: true } });
  if (!client) throw new Error("取引先が見つかりません。");
  const warnings: string[] = [];
  const ctx = await makeRuleCtx((client.billingTerms ?? {}) as BillingTerms, yearMonth, warnings);
  const rule: ShiftBillingRule = { staffName, fromMonth: yearMonth, contract: "MONTHLY", rateExTax: manual.rateExTax, absenceDeduction: manual.absenceDeduction };
  return { staff: await staffFromRule(ctx, rule, manual), warnings };
}

// どの稼働依頼にも契約にも当てはまらない(=どの請求にも入らない)稼働を警告にする。全取引先分なので、この取引先の分があれば「スタッフを追加」で入れる。
async function uncontractedWorkWarning(ctx: RuleCtx): Promise<string | null> {
  const { start, end } = jstMonthRange(ctx.yearMonth);
  const shifts = await prisma.shift.findMany({
    where: { workOrderStaffId: null, cancelledAt: null, startTime: { gte: start, lt: end } },
    include: { clockRecords: true, staff: { select: { name: true } } },
    orderBy: { startTime: "asc" },
  });
  const byStaff = new Map<string, { days: Set<string>; stores: Set<string> }>();
  for (const s of shifts) {
    const key = toJstDateValue(s.startTime);
    if (ctx.used.has(s.id) || !isWorkedShift(s)) continue;
    if (ctx.ruleIndex.owners(s.staff.name, s.storeName, key).length > 0) continue;
    const g = byStaff.get(s.staff.name) ?? { days: new Set<string>(), stores: new Set<string>() };
    g.days.add(key);
    g.stores.add(s.storeName);
    byStaff.set(s.staff.name, g);
  }
  if (!byStaff.size) return null;
  const items = [...byStaff].map(([name, g]) => `${name} ${g.days.size}日（${[...g.stores].slice(0, 3).join("・")}）`);
  const more = items.length > 10 ? ` ほか${items.length - 10}名` : "";
  return `契約にも稼働依頼にも当てはまらず、どの請求にも入っていない稼働があります（全取引先分）。この取引先の分なら「スタッフを追加」で入れてください: ${items.slice(0, 10).join(" / ")}${more}`;
}

// 修正を引き継ぐ元: その取引先・月の最新の請求が、未送信(下書き・承認済み)で明細書を持つ場合だけ。
async function loadCarryOverSource(clientId: string, yearMonth: string) {
  const latest = await prisma.invoice.findFirst({
    where: { clientId, yearMonth },
    orderBy: { revision: "desc" },
    select: { status: true, statement: true, addressee: true, subject: true, note: true },
  });
  if (!latest?.statement || (latest.status !== "DRAFT" && latest.status !== "APPROVED")) return null;
  return { statement: latest.statement as unknown as StatementSnapshot, addressee: latest.addressee, subject: latest.subject, note: latest.note };
}

type DraftResult = { id: string; invoiceNumber: string };

// 請求下書きを作る(管理画面のボタンと、月初の自動作成の両方から使う)。
// 権限チェックは呼び出し側で行うこと。
// carryOver=true なら、前の下書き(未送信)で追加したスタッフ・直した金額/稼働日/店舗/共通項目・宛名・件名・備考を引き継ぐ。
export async function buildInvoiceDraft(clientId: string, yearMonth: string, opts: { carryOver?: boolean } = {}): Promise<DraftResult> {
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

      // 出勤が打刻されたシフトを稼働日として数える(退勤忘れも稼働。isWorkedShift 参照)。
      const completedShifts = assignment.shifts.filter((s) => isWorkedShift(s));
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
      // スタッフに「1日あたりの交通費」が決まっている場合は、それを優先する(稼働日数 × 日額)。
      const fixedDailyTravel = dailyTravelFor(assignment.staff.dailyTravelInclTax, days);
      if (fixedDailyTravel) travel = fixedDailyTravel;

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
  const ctx = await makeRuleCtx(terms, yearMonth, warnings);
  for (const rule of activeShiftRules(terms, yearMonth)) {
    const s = await staffFromRule(ctx, rule);
    if (s) statementStaff.push(s);
  }

  // 前の下書きで「スタッフを追加」したスタッフ(まだ契約に登録されていないもの)を、同じ条件で入れ直す。
  const prev = opts.carryOver ? await loadCarryOverSource(clientId, yearMonth) : null;
  if (prev) {
    for (const old of prev.statement.staff) {
      if (!old.manual || statementStaff.some((x) => normName(x.name) === normName(old.name))) continue;
      const rule: ShiftBillingRule = { staffName: old.name, fromMonth: yearMonth, contract: "MONTHLY", rateExTax: old.manual.rateExTax, absenceDeduction: old.manual.absenceDeduction };
      const s = await staffFromRule(ctx, rule, old.manual);
      if (s) statementStaff.push(s);
      else warnings.push(`前の下書きで追加した${old.name}さんは、今回の稼働実績がない、または他の取引先の契約に当てはまるため、引き継げませんでした。`);
    }
  }
  const { conflicted } = ctx;
  if (conflicted.size) warnings.push(`次のシフトは2社以上の契約に当てはまるため、請求に含めていません。契約の店舗名を見直してください: ${[...conflicted].slice(0, 8).join(" / ")}`);
  if (!orders.length && !statementStaff.length) {
    throw new Error("対象月の承認済み稼働依頼も、シフトからの請求ルールに合う稼働実績もありません。");
  }
  const uncontracted = await uncontractedWorkWarning(ctx);
  if (uncontracted) warnings.push(uncontracted);
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

  // 自動計算の結果を「元の値」として残し(次回の引き継ぎで、手で直した項目を見分けるため)、前の下書きの修正を重ねる。
  const baseline: StatementBaseline = JSON.parse(
    JSON.stringify({
      staff: statementStaff.map((s) => ({ name: s.name, dates: s.dates, dayPlaces: s.dayPlaces, serviceExTax: s.serviceExTax, serviceCalc: s.serviceCalc, travel: s.travel })),
      clientExtras,
    })
  );
  let finalStaff = statementStaff;
  let finalExtras = clientExtras;
  if (opts.carryOver) {
    if (prev) {
      const merged = mergeCarryOver({ staff: statementStaff, clientExtras }, prev.statement);
      finalStaff = merged.staff;
      finalExtras = merged.clientExtras;
      warnings.push(...merged.notes);
    } else {
      warnings.push("引き継げる前の下書き(未送信)がなかったため、新しく計算しました。");
    }
  }

  // 請求書は「業務委託費一式」の1行だけ。交通費相当額なども含めた税抜合計を単価にする。
  const unitPrice = statementBillableExTax({ staff: finalStaff, clientExtras: finalExtras });
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

  const statement: StatementSnapshot = { clientName: client.name, yearMonth, staff: finalStaff, clientExtras: finalExtras, warnings, baseline };

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
      ...(prev ? { addressee: prev.addressee, subject: prev.subject, note: prev.note } : {}),
      lines: { create: lines },
      workOrders: { create: orders.map((o) => ({ workOrderId: o.id })) },
    },
  });

  return { id: invoice.id, invoiceNumber };
}
