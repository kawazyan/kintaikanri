import type { StaffMonthSummary } from "@/lib/staff-month-summary";
import { SubmitButton } from "@/components/submit-button";
import { markFixedPaymentDone, undoFixedPaymentDone } from "./actions";

type Row = { id: string; employeeCode: string; name: string; paymentMethod: "FIXED" | "REQUEST" };

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const md = (key: string) => {
  const [, m, d] = key.split("-").map(Number);
  return `${m}/${d}`;
};
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" }).format(d);

function CountCell({ dates, count, tone }: { dates?: string[]; count?: number; tone: "warn" | "bad" | "ok" }) {
  const n = count ?? dates?.length ?? 0;
  const color = n === 0 ? "text-slate-500" : tone === "bad" ? "text-red-300" : tone === "warn" ? "text-amber-300" : "text-emerald-300";
  return (
    <td className="px-2 py-2 text-center align-top" title={dates?.map(md).join(", ")}>
      <span className={`font-semibold ${color}`}>{n}</span>
      {dates && dates.length > 0 && <div className="mt-0.5 text-[10px] leading-tight text-slate-500">{dates.map(md).join(" ")}</div>}
    </td>
  );
}

export function MonthSummary({
  monthLabel,
  yearMonth,
  staff,
  summaries,
}: {
  monthLabel: string;
  yearMonth: string;
  staff: Row[];
  summaries: Map<string, StaffMonthSummary>;
}) {
  return (
    <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-300">{monthLabel}の勤怠・支払い予定</h2>
      <p className="mb-3 text-xs text-slate-500">
        支払い予定金額 = 受取金額(確定分)＋申請のある経費(申請中・承認済)。支払日が土日祝・12/29〜1/3の場合は直前の銀行営業日に前倒し。
        振り込んだら「振込完了」を押してください。支払日になっても押していない分は「未振込」として赤字で表示します(10/23以降の支払日が対象)。
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-xs text-slate-300">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="px-2 py-2 text-left font-medium">スタッフ</th>
              <th className="px-2 py-2 font-medium">出勤日数</th>
              <th className="px-2 py-2 font-medium">打刻漏れ</th>
              <th className="px-2 py-2 font-medium">定時超過打刻</th>
              <th className="px-2 py-2 font-medium">欠勤</th>
              <th className="px-2 py-2 font-medium">早退</th>
              <th className="px-2 py-2 text-right font-medium">支払い予定金額</th>
              <th className="px-2 py-2 text-left font-medium">支払い予定日</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const m = summaries.get(s.id);
              if (!m) return null;
              return (
                <tr key={s.id} className="border-b border-slate-800/80">
                  <td className="px-2 py-2 align-top">
                    <div className="font-medium text-slate-100">{s.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {s.employeeCode}・{s.paymentMethod === "FIXED" ? "固定支払" : "申請支払"}
                    </div>
                  </td>
                  <CountCell count={m.workDays} tone="ok" />
                  <CountCell dates={m.missedClockDates} tone="warn" />
                  <CountCell dates={m.lateClockInDates} tone="warn" />
                  <CountCell dates={m.absenceDates} tone="bad" />
                  <CountCell dates={m.earlyLeaveDates} tone="warn" />
                  <td className="px-2 py-2 text-right align-top">
                    <div className={m.paymentState === "OVERDUE" ? "font-bold text-red-400" : "font-semibold text-slate-100"}>
                      {m.paymentState === "DONE" && m.paidAmount !== null ? yen(m.paidAmount) : m.total === null ? "金額未確定" : yen(m.total)}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-tight text-slate-500">
                      受取 {m.earnings === null ? "未確定" : yen(m.earnings)}
                      {m.expenses > 0 && (
                        <>
                          <br />
                          経費 {yen(m.expenses)}
                          {m.expensesPending > 0 && `(承認待ち ${yen(m.expensesPending)})`}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    {s.paymentMethod === "FIXED" ? (
                      <>
                        <div className={m.paymentState === "OVERDUE" ? "font-bold text-red-400" : "font-medium text-slate-100"}>
                          {m.paymentDate ? fmtDate(m.paymentDate) : "-"}
                        </div>
                        {m.paymentNote && <div className="mt-0.5 text-[10px] leading-tight text-amber-300/80">{m.paymentNote}</div>}
                        {m.paymentState === "OVERDUE" && <div className="mt-0.5 text-[11px] font-bold text-red-400">未振込</div>}
                        {m.paymentState === "PENDING" && <div className="mt-0.5 text-[10px] text-slate-500">振込前</div>}
                        {m.paymentState === "DONE" && (
                          <div className="mt-0.5 text-[11px] font-semibold text-emerald-400">振込済{m.paidAt ? ` ${fmtDate(m.paidAt)}` : ""}</div>
                        )}
                        {(m.paymentState === "OVERDUE" || m.paymentState === "PENDING") &&
                          (m.total === null ? (
                            <div className="mt-1 text-[10px] text-slate-500">金額確定後に押せます</div>
                          ) : (
                            <form action={markFixedPaymentDone.bind(null, s.id, yearMonth)} className="mt-1">
                              <SubmitButton
                                pendingText="記録中…"
                                className={`rounded-md px-2 py-1 text-[11px] font-bold text-white active:scale-[0.98] ${
                                  m.paymentState === "OVERDUE" ? "bg-red-600" : "bg-gradient-to-r from-blue-600 to-cyan-500"
                                }`}
                              >
                                振込完了
                              </SubmitButton>
                            </form>
                          ))}
                        {m.paymentState === "DONE" && (
                          <form action={undoFixedPaymentDone.bind(null, s.id, yearMonth)} className="mt-0.5">
                            <SubmitButton pendingText="取消中…" className="text-[10px] text-slate-500 underline">
                              取り消す
                            </SubmitButton>
                          </form>
                        )}
                      </>
                    ) : m.requestedEarliestDate ? (
                      <>
                        <div className="font-medium text-slate-100">希望 {fmtDate(m.requestedEarliestDate)}</div>
                        <div className="mt-0.5 text-[10px] leading-tight text-slate-500">申請中 {yen(m.requestedAmount)}</div>
                      </>
                    ) : (
                      <div className="text-slate-500">申請待ち</div>
                    )}
                  </td>
                </tr>
              );
            })}
            {staff.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center text-slate-500">
                  スタッフがいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
