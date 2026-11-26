import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentJstYearMonth, formatJst, jstDayRange, listMonthOptions, toJstDateValue, yearMonthLabel } from "@/lib/time";
import { loadStaffMonthSummaries } from "@/lib/staff-month-summary";
import { syncReferralCompensation } from "@/lib/referral-auto";
import { syncAutoExpenses } from "@/lib/expense-auto";
import { computeMonthlyConfirmedList, computeTransferBalance } from "@/lib/earnings";
import { describeEarnings } from "@/lib/earnings-detail";
import { allocateTransfersByMonth } from "@/lib/transfer-allocation";
import { MonthSummary } from "./month-summary";
import { AdminNav } from "../admin-nav";
import { markTransferRequestPaid, rejectTransferRequest } from "./actions";
import { RejectButton } from "./reject-button";
import { PaidConfirmButton } from "./paid-confirm-button";
import { TransferBalanceSection, type TransferBalanceView } from "./transfer-balance";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; month?: string }>;
}) {
  await requireAdmin();
  const { status, month } = await searchParams;

  // 月のタブ(YYYY-MM)。指定がない・不正な値のときは今月。
  const nowDate = new Date();
  const yearMonth = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : currentJstYearMonth(nowDate);
  const monthTabs = listMonthOptions(5, 1, nowDate);
  if (!monthTabs.some((t) => t.value === yearMonth)) monthTabs.unshift({ value: yearMonth, label: yearMonthLabel(yearMonth) });
  const statusQuery = status === "REQUESTING" || status === "PAID" || status === "REJECTED" ? `&status=${status}` : "";
  const tabHref = (value: string) => `/admin/payments?month=${value}${statusQuery}`;
  const filterHref = (st?: string) => `/admin/payments?month=${yearMonth}${st ? `&status=${st}` : ""}`;

  // 希望振込日が今日以前なのに、まだ振込完了を押していない申請は「未振込」として赤字にする。
  const todayStart = jstDayRange(nowDate).start.getTime();
  const isOverdue = (desired: Date) => desired.getTime() <= todayStart;

  const activeStaff = await prisma.staff.findMany({ where: { status: "ACTIVE" }, orderBy: { employeeCode: "asc" } });
  // 紹介リファラル(渡辺さん)の自動計算。失敗しても画面は止めない。
  let referralNotes: string[] = [];
  try {
    referralNotes = (await syncReferralCompensation(yearMonth, nowDate)).skipped;
  } catch (e) {
    console.error("[referral] 自動計算に失敗しました", e);
  }
  // スタッフごとの経費の自動作成(ガソリン代・毎月の固定の経費)。失敗しても画面は止めない。
  let expenseNotes: string[] = [];
  try {
    expenseNotes = (await syncAutoExpenses(nowDate)).notes;
  } catch (e) {
    console.error("[expense-auto] 経費の自動作成に失敗しました", e);
  }
  const summaries = await loadStaffMonthSummaries(activeStaff, yearMonth, nowDate);

  const requests = await prisma.transferRequest.findMany({
    where: status === "REQUESTING" || status === "PAID" || status === "REJECTED" ? { status } : undefined,
    include: { staff: true },
    orderBy: { requestedAt: "desc" },
    take: 200,
  });

  // 申請支払の人の「支払い可能額」(スタッフ側の申請可能額と同じ計算)と、今月の参考情報(別途報酬)。
  const requestStaffIds = [...new Set(requests.filter((r) => r.status === "REQUESTING").map((r) => r.staffId))];
  const balances = await Promise.all(requestStaffIds.map((id) => computeTransferBalance(id)));
  const balanceByStaff = new Map(requestStaffIds.map((id, i) => [id, balances[i]]));
  const compByStaff = new Map(
    (
      await prisma.compensationRequest.groupBy({
        by: ["staffId"],
        where: { staffId: { in: requestStaffIds }, yearMonth, status: "APPROVED", paidAt: null },
        _sum: { amountTaxInclusive: true },
      })
    ).map((g) => [g.staffId, g._sum.amountTaxInclusive ?? 0])
  );

  // 申請支払の人ごとの「現在の振込可能額残高」と「何月稼働分がいくら振込済みか」(古い月の確定受取から順に充当)。
  const requestMethodStaff = activeStaff.filter((s) => s.paymentMethod === "REQUEST");
  const [monthlyLists, transferRows, approvedExpenses] = await Promise.all([
    Promise.all(requestMethodStaff.map((s) => computeMonthlyConfirmedList(s.id, nowDate))),
    prisma.transferRequest.findMany({
      where: { staffId: { in: requestMethodStaff.map((s) => s.id) }, status: { in: ["REQUESTING", "PAID"] } },
      select: { id: true, staffId: true, status: true, amount: true, paidAmount: true, paidAt: true, desiredPaymentDate: true },
      orderBy: { paidAt: "desc" },
    }),
    // 承認済みの経費(稼働分と同じ「確定した受取」に足して払う。月ごとの内訳に出す)
    prisma.expense.findMany({
      where: { staffId: { in: requestMethodStaff.map((s) => s.id) }, status: "APPROVED" },
      select: { id: true, staffId: true, yearMonth: true, amountTaxInclusive: true, category: true, expenseDate: true },
      orderBy: [{ yearMonth: "asc" }, { expenseDate: "asc" }],
    }),
  ]);
  const balanceViews: TransferBalanceView[] = requestMethodStaff.map((s, i) => {
    const mine = transferRows.filter((t) => t.staffId === s.id);
    // 残高の計算(computeTransferBalance)と同じく、申請額(amount)で数える。
    const paidTotal = mine.filter((t) => t.status === "PAID").reduce((sum, t) => sum + t.amount, 0);
    const requestingTotal = mine.filter((t) => t.status === "REQUESTING").reduce((sum, t) => sum + t.amount, 0);
    return {
      staff: { id: s.id, name: s.name, employeeCode: s.employeeCode },
      // 申請中は月の残りから引かない(振込完了を押した時点で引く)。申請中の合計は pendingTotal で別に出す。
      alloc: allocateTransfersByMonth(monthlyLists[i].map((m) => ({ yearMonth: m.yearMonth, confirmed: m.confirmed })), paidTotal, 0),
      pendingTotal: requestingTotal,
      monthLabels: Object.fromEntries(monthlyLists[i].map((m) => [m.yearMonth, m.detail ? describeEarnings(m.detail).short : "-"])),
      workByMonth: Object.fromEntries(monthlyLists[i].map((m) => [m.yearMonth, m.work])),
      expenses: approvedExpenses.filter((e) => e.staffId === s.id).map((e) => ({ id: e.id, yearMonth: e.yearMonth, amount: e.amountTaxInclusive, category: e.category, expenseDate: e.expenseDate })),
      paidHistory: mine
        .filter((t) => t.status === "PAID")
        .map((t) => ({ id: t.id, paidAt: t.paidAt, amount: t.amount, paidAmount: t.paidAmount, desiredPaymentDate: t.desiredPaymentDate })),
    };
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <AdminNav />
      <h1 className="kj-page-title">
        振込関係
      </h1>

      {referralNotes.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-black">リファラル報酬を自動で作れませんでした（一部の人が計算できないため、作っていません）</p>
          <ul className="mt-1 list-disc pl-5">
            {referralNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {expenseNotes.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-black">経費の自動計算で、確認が必要なものがあります</p>
          <ul className="mt-1 list-disc pl-5">
            {expenseNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <nav className="mb-3 flex gap-1 overflow-x-auto" aria-label="月の切り替え">
        {monthTabs.map((t) => (
          <a
            key={t.value}
            href={tabHref(t.value)}
            aria-current={t.value === yearMonth ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
              t.value === yearMonth
                ? "bg-gradient-to-r from-blue-600 to-cyan-500 font-semibold text-white"
                : "border border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label.replace(/^\d{4}年/, "")}
          </a>
        ))}
      </nav>
      <MonthSummary monthLabel={yearMonthLabel(yearMonth)} yearMonth={yearMonth} staff={activeStaff} summaries={summaries} />

      <TransferBalanceSection views={balanceViews} />

      <h2 className="mb-3 text-sm font-semibold text-slate-300">振込申請一覧</h2>

      <div className="mb-4 flex gap-3 text-sm">
        <a
          href={filterHref()}
          className={!status ? "font-semibold text-cyan-300" : "text-blue-400 underline"}
        >
          全て
        </a>
        <a
          href={filterHref("REQUESTING")}
          className={status === "REQUESTING" ? "font-semibold text-cyan-300" : "text-blue-400 underline"}
        >
          申請中のみ
        </a>
        <a
          href={filterHref("PAID")}
          className={status === "PAID" ? "font-semibold text-cyan-300" : "text-blue-400 underline"}
        >
          振込済みのみ
        </a>
        <a
          href={filterHref("REJECTED")}
          className={status === "REJECTED" ? "font-semibold text-cyan-300" : "text-blue-400 underline"}
        >
          却下のみ
        </a>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500">
              <th className="py-2 pr-3 pl-4">スタッフ</th>
              <th className="py-2 pr-3">申請日時</th>
              <th className="py-2 pr-3">申請金額</th>
              <th className="py-2 pr-3">希望振込日</th>
              <th className="py-2 pr-3">ステータス</th>
              <th className="py-2 pr-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/60 align-top text-slate-200">
                <td className="py-2 pr-3 pl-4">
                  {r.staff.name}({r.staff.employeeCode})
                </td>
                <td className="py-2 pr-3">{formatJst(r.requestedAt)}</td>
                <td className="py-2 pr-3">{r.amount.toLocaleString("ja-JP")}円</td>
                <td className={`py-2 pr-3 ${r.status === "REQUESTING" && isOverdue(r.desiredPaymentDate) ? "font-bold text-red-400" : ""}`}>
                  {new Intl.DateTimeFormat("ja-JP", {
                    timeZone: "Asia/Tokyo",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(r.desiredPaymentDate)}
                </td>
                <td className="py-2 pr-3">
                  {r.status === "PAID" ? (
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                      振込済み
                    </span>
                  ) : r.status === "REJECTED" ? (
                    <span className="rounded bg-slate-500/20 px-2 py-0.5 text-xs font-medium text-slate-400">却下</span>
                  ) : (
                    isOverdue(r.desiredPaymentDate) ? (
                      <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-400">未振込</span>
                    ) : (
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                        申請中
                      </span>
                    )
                  )}
                  {r.status === "REJECTED" && (
                    <div className="mt-1 text-xs text-slate-500">
                      {r.rejectedAt && formatJst(r.rejectedAt)}
                      {r.rejectionReason && ` / 理由: ${r.rejectionReason}`}
                      {r.rejectedByOperatorName && ` / 処理者: ${r.rejectedByOperatorName}`}
                    </div>
                  )}
                  {r.status === "PAID" && (
                    <div className="mt-1 text-xs text-slate-500">
                      振込日 {r.paidAt && formatJst(r.paidAt)} / 振込金額 {(r.paidAmount ?? r.amount).toLocaleString("ja-JP")}円
                      {r.paidByOperatorName && ` / 処理者: ${r.paidByOperatorName}`}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-3">
                  {r.status === "REQUESTING" && balanceByStaff.has(r.staffId) && (() => {
                    const b = balanceByStaff.get(r.staffId)!;
                    const comp = compByStaff.get(r.staffId) ?? 0;
                    return (
                      <details className="mb-3 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-slate-300">
                        <summary className="cursor-pointer font-semibold text-cyan-300">支払い可能額を見る</summary>
                        <dl className="mt-2 space-y-1">
                          <div className="flex justify-between gap-4"><dt>確定受取(累計・稼働分＋承認済みの経費)</dt><dd>{b.confirmedAmount.toLocaleString("ja-JP")}円</dd></div>
                          <div className="flex justify-between gap-4"><dt>振込済み</dt><dd>-{b.paidAmount.toLocaleString("ja-JP")}円</dd></div>
                          <div className="flex justify-between gap-4 border-t border-slate-700 pt-1 font-bold text-slate-100"><dt>支払い可能額</dt><dd>{b.availableAmount.toLocaleString("ja-JP")}円</dd></div>
                        </dl>
                        <div className="mt-2 border-t border-slate-800 pt-2 text-[11px] text-slate-500">
                          <div>参考(支払い可能額には含まれていません)。経費は、承認済みの分が確定受取に入っています。</div>
                          <div className="flex justify-between gap-4"><span>申請中の合計(この申請を含む)</span><span>{b.pendingAmount.toLocaleString("ja-JP")}円</span></div>
                          {b.pendingAmount > b.availableAmount && (
                            <div className="mt-1 font-bold text-red-400">申請中の合計が支払い可能額を超えています。重複した申請がないか確認してください。</div>
                          )}
                          <div className="flex justify-between gap-4"><span>今月の別途報酬(承認済・未振込)</span><span>{comp > 0 ? `${comp.toLocaleString("ja-JP")}円` : "-"}</span></div>
                        </div>
                      </details>
                    );
                  })()}
                  {r.status === "REQUESTING" && (
                    <form action={markTransferRequestPaid.bind(null, r.id)} className="flex flex-col gap-1">
                      <input
                        type="number"
                        name="paidAmount"
                        placeholder={String(r.amount)}
                        min={1}
                        className="w-28 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        name="operatorName"
                        placeholder="処理者名"
                        className="w-28 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                      <PaidConfirmButton
                        expectedDate={toJstDateValue(r.desiredPaymentDate)}
                        expectedLabel="希望振込日"
                        staffName={r.staff.name}
                        amountText={`申請額 ${r.amount.toLocaleString("ja-JP")}円`}
                        className="rounded-md bg-gradient-to-r from-blue-600 to-cyan-500 px-2 py-1 text-xs text-white shadow-md shadow-blue-950/50 active:scale-[0.98] disabled:opacity-50"
                      >
                        振込完了
                      </PaidConfirmButton>
                    </form>
                  )}
                  {r.status === "REQUESTING" && (
                    <form action={rejectTransferRequest.bind(null, r.id)} className="mt-3 flex flex-col gap-1 border-t border-slate-800 pt-2">
                      <input
                        type="text"
                        name="reason"
                        placeholder="却下の理由(任意)"
                        className="w-28 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        name="operatorName"
                        placeholder="処理者名"
                        className="w-28 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                      <RejectButton staffName={r.staff.name} amount={r.amount} />
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && (
          <p className="p-4 text-sm text-slate-500">振込申請がありません。</p>
        )}
      </div>
    </main>
  );
}
