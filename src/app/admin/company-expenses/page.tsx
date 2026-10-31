import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expenseGateConfigured, isExpenseUnlocked } from "@/lib/expense-gate";
import { COMPANY_EXPENSE_CATEGORIES, isYearMonth } from "@/lib/company-expense";
import { currentJstYearMonth, listMonthOptions, toJstDateValue, yearMonthLabel } from "@/lib/time";
import { AdminNav } from "../admin-nav";
import { UnlockForm } from "./unlock-form";
import { AddExpenseForm } from "./add-form";
import { DeleteExpenseButton } from "./delete-button";
import { deleteCompanyExpense, lockCompanyExpenses } from "./actions";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const INK = "text-[#1e293b]";
const MUTED = "text-[#475569]";

export default async function CompanyExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();

  if (!expenseGateConfigured()) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AdminNav />
        <p className="mt-10 rounded-xl border-2 border-[#f59e0b] bg-[#fffbeb] p-4 text-sm font-bold text-[#92400e]">
          このページのパスワードが、まだ設定されていません(環境変数 EXPENSE_PAGE_PASSWORD)。設定するまでは誰も開けません。
        </p>
      </main>
    );
  }
  if (!(await isExpenseUnlocked())) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AdminNav />
        <UnlockForm />
      </main>
    );
  }

  const { month: monthRaw } = await searchParams;
  const now = new Date();
  const yearMonth = monthRaw && isYearMonth(monthRaw) ? monthRaw : currentJstYearMonth(now);
  const monthTabs = listMonthOptions(5, 1, now);
  if (!monthTabs.some((t) => t.value === yearMonth)) monthTabs.unshift({ value: yearMonth, label: yearMonthLabel(yearMonth) });

  const rows = await prisma.companyExpense.findMany({ where: { yearMonth }, orderBy: [{ expenseDate: "asc" }, { createdAt: "asc" }] });
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const recurringTotal = rows.filter((r) => r.recurring).reduce((sum, r) => sum + r.amount, 0);
  const byCategory = COMPANY_EXPENSE_CATEGORIES.map((c) => ({ category: c, sum: rows.filter((r) => r.category === c).reduce((s, r) => s + r.amount, 0), count: rows.filter((r) => r.category === c).length })).filter((c) => c.count > 0);
  const today = toJstDateValue(now);
  const defaultDate = today.slice(0, 7) === yearMonth ? today : `${yearMonth}-01`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <AdminNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`text-2xl font-extrabold ${INK}`}>会社経費</h1>
        <form action={lockCompanyExpenses}>
          <button type="submit" className="rounded-lg border border-[#94a3b8] px-3 py-1.5 text-sm font-bold text-[#475569]">
            ロックする
          </button>
        </form>
      </div>
      <p className={`mt-1 text-sm ${MUTED}`}>家賃・カード・駐車場代・税理士顧問料など。このページはパスワードを知っている人だけが見られます。</p>

      <nav className="mt-4 flex gap-1 overflow-x-auto" aria-label="月の切り替え">
        {monthTabs.map((t) => (
          <a
            key={t.value}
            href={`/admin/company-expenses?month=${t.value}`}
            aria-current={t.value === yearMonth ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-bold ${t.value === yearMonth ? "bg-[#1d4ed8] text-white" : "border border-[#94a3b8] text-[#475569]"}`}
          >
            {t.label.replace(/^\d{4}年/, "")}
          </a>
        ))}
      </nav>

      <section className="mt-4 rounded-2xl border-2 border-[#cbd5e1] bg-white p-5 shadow-sm">
        <p className={`text-sm font-bold ${MUTED}`}>{yearMonthLabel(yearMonth)}の経費 合計</p>
        <p className={`text-3xl font-extrabold ${INK}`}>{yen(total)}</p>
        <p className={`mt-1 text-sm ${MUTED}`}>うち毎月かかる固定費 {yen(recurringTotal)}</p>
        {byCategory.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {byCategory.map((c) => (
              <span key={c.category} className="rounded-full border border-[#94a3b8] bg-[#f8fafc] px-3 py-1 text-xs font-bold text-[#1e293b]">
                {c.category} {yen(c.sum)}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="mt-4 overflow-x-auto rounded-2xl border-2 border-[#cbd5e1] bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#cbd5e1] text-xs text-[#475569]">
              <th className="py-2 pr-3 pl-4 font-bold">日付</th>
              <th className="py-2 pr-3 font-bold">区分</th>
              <th className="py-2 pr-3 font-bold">項目</th>
              <th className="py-2 pr-3 text-right font-bold">金額</th>
              <th className="py-2 pr-3 font-bold">メモ</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody className={INK}>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#e2e8f0] align-top">
                <td className="py-2 pr-3 pl-4 whitespace-nowrap">{r.expenseDate.slice(5).replace("-", "/")}</td>
                <td className="py-2 pr-3">
                  {r.category}
                  {r.recurring && <span className="ml-1 rounded border border-[#60a5fa] bg-[#eff6ff] px-1 text-[10px] font-bold text-[#1d4ed8]">固定</span>}
                </td>
                <td className="py-2 pr-3 font-bold">{r.item}</td>
                <td className="py-2 pr-3 text-right font-bold whitespace-nowrap">{yen(r.amount)}</td>
                <td className="py-2 pr-3 text-xs text-[#475569]">{r.memo ?? ""}</td>
                <td className="py-2 pr-3">
                  <form action={deleteCompanyExpense.bind(null, r.id)}>
                    <DeleteExpenseButton label={`${r.item} ${yen(r.amount)}`} />
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className={`p-4 text-sm ${MUTED}`}>この月の経費はまだありません。</p>}
      </div>

      <div className="mt-4">
        <AddExpenseForm defaultDate={defaultDate} />
      </div>
    </main>
  );
}
