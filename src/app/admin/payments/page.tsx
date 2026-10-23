import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentJstYearMonth, formatJst, listMonthOptions, yearMonthLabel } from "@/lib/time";
import { loadStaffMonthSummaries } from "@/lib/staff-month-summary";
import { MonthSummary } from "./month-summary";
import { AdminNav } from "../admin-nav";
import { markTransferRequestPaid } from "./actions";
import { SubmitButton } from "@/components/submit-button";

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
  const statusQuery = status === "REQUESTING" || status === "PAID" ? `&status=${status}` : "";
  const tabHref = (value: string) => `/admin/payments?month=${value}${statusQuery}`;
  const filterHref = (st?: string) => `/admin/payments?month=${yearMonth}${st ? `&status=${st}` : ""}`;

  const activeStaff = await prisma.staff.findMany({ where: { status: "ACTIVE" }, orderBy: { employeeCode: "asc" } });
  const summaries = await loadStaffMonthSummaries(activeStaff, yearMonth, nowDate);

  const requests = await prisma.transferRequest.findMany({
    where: status === "REQUESTING" || status === "PAID" ? { status } : undefined,
    include: { staff: true },
    orderBy: { requestedAt: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <AdminNav />
      <h1 className="mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-xl font-bold text-transparent">
        振込関係
      </h1>

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
      <MonthSummary monthLabel={yearMonthLabel(yearMonth)} staff={activeStaff} summaries={summaries} />

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
                <td className="py-2 pr-3">
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
                  ) : (
                    <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                      申請中
                    </span>
                  )}
                  {r.status === "PAID" && (
                    <div className="mt-1 text-xs text-slate-500">
                      {r.paidAt && formatJst(r.paidAt)} / {r.paidAmount?.toLocaleString("ja-JP")}円
                      {r.paidByOperatorName && ` / 処理者: ${r.paidByOperatorName}`}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-3">
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
                      <SubmitButton
                        className="rounded-md bg-gradient-to-r from-blue-600 to-cyan-500 px-2 py-1 text-xs text-white shadow-md shadow-blue-950/50 active:scale-[0.98]"
                      >
                        振込済みにする
                      </SubmitButton>
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
