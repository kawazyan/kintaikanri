import type { StaffMonthSummary } from "@/lib/staff-month-summary";
import { SubmitButton } from "@/components/submit-button";
import { describeEarnings } from "@/lib/earnings-detail";
import { toJstDateValue } from "@/lib/time";
import { markFixedPaymentDone, setManualPayAmount, setMonthlyMaxAmount, undoFixedPaymentDone } from "./actions";
import { PaidConfirmButton } from "./paid-confirm-button";
import { OperatorNameInput } from "@/components/operator-name-input";

type Row = { id: string; employeeCode: string; name: string; paymentMethod: "FIXED" | "REQUEST"; payType: "DAILY" | "MONTHLY" | "MANUAL" | null };

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const md = (key: string) => {
  const [, m, d] = key.split("-").map(Number);
  return `${m}/${d}`;
};
const categoryLabel: Record<"TRAVEL" | "LODGING" | "OTHER", string> = { TRAVEL: "交通費", LODGING: "宿泊費", OTHER: "その他" };
const compCategoryLabel: Record<"REFERRAL" | "INCENTIVE" | "OTHER", string> = { REFERRAL: "リファラル報酬", INCENTIVE: "インセンティブ", OTHER: "その他" };
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" }).format(d);

// 勤怠の件数(出勤日数・打刻漏れ・定時超過打刻・欠勤・早退)。0件は薄く、あるものは色つきで日付も出す。
function Chip({ label, count, dates, tone }: { label: string; count?: number; dates?: string[]; tone: "warn" | "bad" | "ok" }) {
  const n = count ?? dates?.length ?? 0;
  const color =
    n === 0
      ? "border-slate-200 text-slate-400"
      : tone === "bad"
        ? "border-red-300 bg-red-50 text-red-700"
        : tone === "warn"
          ? "border-amber-300 bg-amber-50 text-amber-800"
          : "border-emerald-300 bg-emerald-50 text-emerald-800";
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs ${color}`} title={dates?.map(md).join(", ")}>
      {label} <b className="text-sm">{n}</b>
      {dates && dates.length > 0 && <span className="ml-1 text-xs opacity-80">({dates.map(md).join(" ")})</span>}
    </span>
  );
}

// 支払い予定金額の計算式(例: 受取 ¥230,000 ＋ 経費 ¥3,200 ＋ 別途報酬 ¥30,000(振込済に含む) ＝ ¥263,200)。
function formulaText(s: Row, m: StaffMonthSummary): string | null {
  if (s.payType === "MANUAL") return "手入力(その月の金額をそのまま)";
  if (m.earnings === null) return null;
  // 固定支払の「振込完了」に含めて払った別途報酬も、計算に並べる(記録金額と突き合わせるため)。
  const bundled = m.compensationItems.filter((c) => c.bundledInFixedPayment).reduce((sum, c) => sum + c.amountTaxInclusive, 0);
  const parts = [
    `受取 ${yen(m.earnings)}`,
    m.expenses > 0 ? `経費 ${yen(m.expenses)}` : null,
    m.compensation > 0 ? `別途報酬 ${yen(m.compensation)}` : null,
    bundled > 0 ? `別途報酬 ${yen(bundled)}(振込済に含む)` : null,
  ].filter(Boolean);
  const sum = m.earnings + m.expenses + m.compensation + bundled;
  return `${parts.join(" ＋ ")}${parts.length > 1 ? ` ＝ ${yen(sum)}` : ""}`;
}

const inputCls = "w-28 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-sm text-slate-900 disabled:opacity-50";
const opCls = "w-28 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400";
const saveCls = "rounded-md bg-[#21394f] px-3 py-1.5 text-sm font-bold text-white";

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
    <section className="kj-data-table-panel mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-300">{monthLabel}の勤怠・支払い予定</h2>
      <p className="mb-3 text-xs text-slate-500">
        支払い予定金額 = 受取(確定分)＋経費(申請中・承認済)＋別途報酬(承認済・未振込分)。支払日が土日祝・12/29〜1/3の場合は直前の銀行営業日に前倒し。
        振り込んだら「振込完了」を押してください。支払日になっても押していない分は「未振込」として赤字で表示します(10/23以降の支払日が対象)。
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {staff.map((s) => {
          const m = summaries.get(s.id);
          if (!m) return null;
          const desc = m.earningsDetail ? describeEarnings(m.earningsDetail) : null;
          const formula = formulaText(s, m);
          const done = m.paymentState === "DONE";
          const overdue = m.paymentState === "OVERDUE";
          return (
            <article key={s.id} className={`rounded-xl border bg-white p-4 ${overdue ? "border-red-400" : "border-slate-200"}`}>
              {/* 1. 誰の・いつ払うか */}
              <header className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-slate-100">{s.name}</div>
                  <div className="text-xs text-slate-500">
                    {s.employeeCode}・{s.paymentMethod === "FIXED" ? "固定支払" : "申請支払"}
                  </div>
                </div>
                <div className="text-right">
                  {s.paymentMethod === "FIXED" ? (
                    <>
                      <div className="text-xs text-slate-500">支払い予定日</div>
                      <div className={`text-base font-bold ${overdue ? "text-red-600" : "text-slate-900"}`}>{m.paymentDate ? fmtDate(m.paymentDate) : "-"}</div>
                      {m.paymentNote && <div className="mt-0.5 text-xs leading-tight text-amber-700">{m.paymentNote}</div>}
                      {overdue && <div className="mt-0.5 text-sm font-bold text-red-600">未振込</div>}
                      {m.paymentState === "PENDING" && <div className="mt-0.5 text-xs text-slate-500">振込前</div>}
                    </>
                  ) : m.requestedEarliestDate ? (
                    <>
                      <div className="text-xs text-slate-500">希望振込日</div>
                      <div className="text-base font-bold text-slate-100">{fmtDate(m.requestedEarliestDate)}</div>
                      <div className="mt-0.5 text-xs text-slate-400">申請中 {yen(m.requestedAmount)}</div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-500">申請待ち</div>
                  )}
                </div>
              </header>

              {/* 2. 支払い予定金額(振込済みなら振込日・振込金額) */}
              <div className={`mt-3 rounded-lg px-3 py-2 ${done ? "border border-emerald-200 bg-emerald-50" : "border border-slate-200 bg-slate-50"}`}>
                {done ? (
                  <>
                    <div className="text-sm font-bold text-emerald-700">振込済{m.paidAt ? `　振込日 ${fmtDate(m.paidAt)}` : ""}</div>
                    <div className="text-xs text-slate-400">振込金額</div>
                    <div className="text-2xl font-bold text-emerald-700">{m.paidAmount !== null ? yen(m.paidAmount) : "-"}</div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-slate-400">支払い予定金額</div>
                    <div className={`text-2xl font-bold ${overdue ? "text-red-600" : "text-slate-900"}`}>{m.total === null ? "金額未確定" : yen(m.total)}</div>
                  </>
                )}
                {formula && <div className="mt-1 text-xs leading-snug text-slate-400">計算: {formula}</div>}
              </div>

              {/* 3. 金額の内訳 */}
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-semibold text-slate-200">
                      受取
                      {desc && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                          {monthLabel}分・{desc.modeLabel}
                        </span>
                      )}
                    </span>
                    <span className="text-base font-bold text-slate-100">{m.earnings === null ? "未確定" : yen(m.earnings)}</span>
                  </div>
                  {desc && (
                    <dl className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm">
                      {desc.rows.map((r) => (
                        <div
                          key={r.label}
                          className={`flex items-baseline justify-between gap-3 py-1.5 ${r.strong ? "border-t border-slate-300 font-bold text-slate-900" : "border-t border-slate-200 first:border-t-0 text-slate-700"}`}
                        >
                          <dt>
                            {r.label}
                            {r.note && <span className="ml-1.5 text-xs font-normal text-slate-500">({r.note})</span>}
                          </dt>
                          <dd className="whitespace-nowrap text-right tabular-nums">{r.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>

                <div>
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-slate-200">経費</span>
                    <span className="font-semibold text-slate-100">{m.expenses > 0 ? yen(m.expenses) : "-"}</span>
                  </div>
                  {m.expenseItems.length > 0 && (
                    <ul className="mt-1 space-y-0.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs leading-snug text-slate-400">
                      {m.expenseItems.map((e) => (
                        <li key={e.id} className="flex justify-between gap-2">
                          <span>
                            {fmtDate(e.expenseDate)} {categoryLabel[e.category]}
                            {e.description ? `(${e.description})` : ""}
                            {e.status === "SUBMITTED" && <span className="ml-1 font-semibold text-amber-700">承認待ち</span>}
                          </span>
                          <span className="whitespace-nowrap text-slate-200">{yen(e.amountTaxInclusive)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-slate-200">別途報酬(リファラル等)</span>
                    <span className="font-semibold text-slate-100">
                      {s.paymentMethod !== "FIXED" ? <span className="text-xs font-normal text-slate-500">対象外</span> : m.compensation > 0 ? yen(m.compensation) : "-"}
                    </span>
                  </div>
                  {s.paymentMethod === "FIXED" && m.compensationItems.length > 0 && (
                    <ul className="mt-1 space-y-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs leading-snug text-slate-400">
                      {m.compensationItems.map((c) => (
                        <li key={c.id}>
                          <div className="flex justify-between gap-2">
                            <span>
                              {monthLabel}分 {compCategoryLabel[c.category]}
                              {c.description ? `(${c.description})` : ""}
                              {c.bundledInFixedPayment && <span className="ml-1 font-semibold text-emerald-700">振込済に含む</span>}
                            </span>
                            <span className="whitespace-nowrap text-slate-200">{yen(c.amountTaxInclusive)}</span>
                          </div>
                          {c.items.map((it, i) => (
                            <div key={i} className="flex justify-between gap-2 pl-3 text-slate-500">
                              <span>
                                ・{it.label}
                                {it.memo ? `(${it.memo})` : ""}
                              </span>
                              <span className="whitespace-nowrap">{yen(it.amount)}</span>
                            </div>
                          ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* 4. 勤怠 */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip label="出勤日数" count={m.workDays} tone="ok" />
                <Chip label="打刻漏れ" dates={m.missedClockDates} tone="warn" />
                <Chip label="定時超過打刻" dates={m.lateClockInDates} tone="warn" />
                <Chip label="欠勤" dates={m.absenceDates} tone="bad" />
                <Chip label="早退" dates={m.earlyLeaveDates} tone="warn" />
              </div>

              {/* 5. 金額の入力(手入力・月の満額) */}
              {s.payType === "MANUAL" && (
                <form action={setManualPayAmount.bind(null, s.id, yearMonth)} className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">支払い金額(手入力)</span>
                  <input
                    key={m.earnings ?? "none"}
                    type="text"
                    name="amount"
                    inputMode="numeric"
                    placeholder="金額を入力"
                    defaultValue={m.earnings ?? ""}
                    disabled={done}
                    aria-label={`${s.name}の${monthLabel}の支払い金額`}
                    className={inputCls}
                  />
                  {!done && <OperatorNameInput className={opCls} />}
                  {!done && (
                    <SubmitButton pendingText="保存中…" className={saveCls}>
                      保存
                    </SubmitButton>
                  )}
                </form>
              )}
              {s.payType !== "MANUAL" && s.payType !== "DAILY" && (
                <form action={setMonthlyMaxAmount.bind(null, s.id, yearMonth)} className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">月の満額</span>
                  <input
                    key={m.monthlyMax ?? "none"}
                    type="text"
                    name="amount"
                    inputMode="numeric"
                    placeholder={s.payType === "MONTHLY" ? "設定の月額" : "未入力"}
                    defaultValue={m.monthlyMax ?? ""}
                    disabled={done}
                    aria-label={`${s.name}の${monthLabel}の報酬の満額`}
                    className={inputCls}
                  />
                  {!done && <OperatorNameInput className={opCls} />}
                  {!done && (
                    <SubmitButton pendingText="保存中…" className={saveCls}>
                      保存
                    </SubmitButton>
                  )}
                </form>
              )}

              {/* 6. 振込完了ボタン(固定支払のみ) */}
              {s.paymentMethod === "FIXED" && (
                <div className="mt-3 flex items-center gap-3">
                  {(overdue || m.paymentState === "PENDING") &&
                    (m.total === null ? (
                      <div className="text-xs text-slate-500">金額確定後に押せます</div>
                    ) : (
                      <form action={markFixedPaymentDone.bind(null, s.id, yearMonth)} className="flex flex-wrap items-center gap-2">
                        <OperatorNameInput className={opCls} />
                        {m.paymentDate ? (
                          <PaidConfirmButton
                            expectedDate={toJstDateValue(m.paymentDate)}
                            expectedLabel="支払い予定日"
                            staffName={s.name}
                            amountText={yen(m.total)}
                            className={`rounded-md px-4 py-2 text-sm font-bold text-white active:scale-[0.98] ${
                              overdue ? "bg-red-600" : "bg-gradient-to-r from-blue-600 to-cyan-500"
                            }`}
                          >
                            振込完了
                          </PaidConfirmButton>
                        ) : (
                          <SubmitButton pendingText="記録中…" className="rounded-md bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-bold text-white active:scale-[0.98]">
                            振込完了
                          </SubmitButton>
                        )}
                      </form>
                    ))}
                  {done && (
                    <form action={undoFixedPaymentDone.bind(null, s.id, yearMonth)} className="flex flex-wrap items-center gap-2">
                      <OperatorNameInput className={opCls} />
                      <SubmitButton pendingText="取消中…" className="text-xs text-slate-500 underline">
                        取り消す
                      </SubmitButton>
                    </form>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {staff.length === 0 && <p className="py-4 text-center text-slate-500">スタッフがいません</p>}
      </div>
    </section>
  );
}
