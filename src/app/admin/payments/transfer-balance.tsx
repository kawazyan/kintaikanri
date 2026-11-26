import type { AllocationResult } from "@/lib/transfer-allocation";
import { yearMonthLabel } from "@/lib/time";

// 申請支払の人ごとの「現在の振込可能額残高」と「何月稼働分がいくら振込済みか」。
// 申請は月に紐づいていないので、振込済み・申請中は古い月の確定受取から順に充当して表示している。

export type TransferBalanceView = {
  staff: { id: string; name: string; employeeCode: string };
  alloc: AllocationResult;
  pendingTotal: number; // 申請中の合計(振り込める額からは引かない。振込完了を押した時点で引く)
  monthLabels: Record<string, string>; // yearMonth → 内訳の1行要約(1日あたり/月固定など)
  workByMonth: Record<string, number>; // yearMonth → 稼働分(経費を除く)
  // 承認済みの経費(稼働分と一緒に払う。月ごとの内訳に出す)
  expenses: { id: string; yearMonth: string; amount: number; category: "TRAVEL" | "LODGING" | "OTHER"; expenseDate: Date }[];
  paidHistory: { id: string; paidAt: Date | null; amount: number; paidAmount: number | null; desiredPaymentDate: Date }[];
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const fmtDay = (d: Date) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).format(d);
const categoryLabel: Record<"TRAVEL" | "LODGING" | "OTHER", string> = { TRAVEL: "交通費", LODGING: "宿泊費", OTHER: "その他の経費" };
const dayKey = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).format(d);

// 月ごとの状態(ひと目で分かるようにバッジで出す)
function monthStatus(r: { confirmed: number; paid: number; requesting: number; remaining: number }) {
  if (r.remaining <= 0 && r.requesting <= 0 && r.paid > 0) return { text: "全額支払い済み", cls: "bg-emerald-100 text-emerald-800" };
  if (r.requesting > 0) return { text: `申請中 ${yen(r.requesting)}`, cls: "bg-amber-100 text-amber-800" };
  if (r.paid > 0) return { text: "一部支払い済み", cls: "bg-sky-100 text-sky-800" };
  return { text: "これから振込", cls: "bg-slate-200 text-slate-700" };
}

export function TransferBalanceSection({ views }: { views: TransferBalanceView[] }) {
  if (views.length === 0) return null;
  return (
    <section className="kj-data-table-panel mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-300">申請支払の人の振込残高</h2>
      <p className="mb-3 text-xs text-slate-500">今、振り込める額 ＝ 確定した受取（稼働分＋承認済みの経費） − 振込済み。申請中の金額は、「振込完了」を押した時点で引かれます。月ごとの払い済みは、古い月から順に当てはめた計算で、全額払い済みの月は出しません。別途報酬は含みません。</p>
      <div className="space-y-4">
        {views.map((v) => {
          const a = v.alloc;
          // 全額払い済みの月は出さない(未払いが残っている月だけ)。
          const rows = a.rows.filter((r) => r.remaining > 0);
          const mismatch = v.paidHistory.some((h) => h.paidAmount !== null && h.paidAmount !== h.amount);
          return (
            <div key={v.staff.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-end justify-between gap-2">
                <div className="font-medium text-slate-100">
                  {v.staff.name}
                  <span className="ml-1 text-xs text-slate-500">{v.staff.employeeCode}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">今、振り込める額</div>
                  <div className={`text-2xl font-bold ${a.available > 0 ? "text-emerald-700" : "text-slate-500"}`}>{yen(a.available)}</div>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-100 px-2 py-1.5">
                  <div className="text-[11px] text-slate-500">確定した受取（稼働分＋経費）</div>
                  <div className="text-sm font-semibold text-slate-100">{yen(a.totalConfirmed)}</div>
                </div>
                <div className="rounded-lg bg-slate-100 px-2 py-1.5">
                  <div className="text-[11px] text-slate-500">振込済み</div>
                  <div className="text-sm font-semibold text-emerald-700">{yen(a.paidTotal)}</div>
                </div>
                <div className="rounded-lg bg-slate-100 px-2 py-1.5">
                  <div className="text-[11px] text-slate-500">申請中（まだ引かない）</div>
                  <div className={`text-sm font-semibold ${v.pendingTotal > 0 ? "text-amber-700" : "text-slate-500"}`}>{yen(v.pendingTotal)}</div>
                </div>
              </div>

              {v.pendingTotal > a.available && (
                <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                  申請中の合計（{yen(v.pendingTotal)}）が、今、振り込める額（{yen(a.available)}）を超えています。重複した申請がないか確認してください。
                </div>
              )}

              {a.overPaid > 0 && (
                <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                  確定受取を超えて振込済み・申請中になっています(超過 {yen(a.overPaid)})。打刻漏れ・金額の入力漏れがないか確認してください。
                </div>
              )}

              <ul className="mt-3 divide-y divide-slate-200">
                {rows.map((r) => {
                  const st = monthStatus(r);
                  const monthExpenses = v.expenses.filter((e) => e.yearMonth === r.yearMonth);
                  const work = v.workByMonth[r.yearMonth] ?? r.confirmed - monthExpenses.reduce((sum, e) => sum + e.amount, 0);
                  return (
                    <li key={r.yearMonth} className="py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100">{yearMonthLabel(r.yearMonth)}分</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.text}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-100">{yen(r.confirmed)}</span>
                      </div>
                      <div className="mt-1 space-y-0.5 pl-3 text-[11px] text-slate-500">
                        {work > 0 && (
                          <div className="flex justify-between gap-2">
                            <span>稼働分　{v.monthLabels[r.yearMonth] ?? ""}</span>
                            <span className="whitespace-nowrap text-slate-300">{yen(work)}</span>
                          </div>
                        )}
                        {monthExpenses.map((e) => (
                          <div key={e.id} className="flex justify-between gap-2">
                            <span>{categoryLabel[e.category]}　{fmtDay(e.expenseDate)}・承認済み</span>
                            <span className="whitespace-nowrap text-slate-300">{yen(e.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1 flex justify-end gap-3 text-[11px] text-slate-500">
                        <span>払い済み {yen(r.paid)}</span>
                        <span className={r.remaining > 0 ? "whitespace-nowrap font-semibold text-slate-700" : ""}>残り {yen(r.remaining)}</span>
                      </div>
                    </li>
                  );
                })}
                {rows.length === 0 && <li className="py-3 text-center text-xs text-slate-500">未払いの月はありません（確定した受取は、すべて振込済みです）</li>}
              </ul>

              <details className="group mt-2 text-xs text-slate-400">
                <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold text-slate-300 [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">▸</span>
                  <span className="hidden group-open:inline">▾</span>
                  振込済みの履歴（{v.paidHistory.length}件）
                </summary>
                {v.paidHistory.length === 0 ? (
                  <div className="mt-1 text-slate-500">まだ振込済みがありません</div>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {v.paidHistory.map((h) => {
                      const diffDay = h.paidAt ? dayKey(h.paidAt) !== dayKey(h.desiredPaymentDate) : false;
                      return (
                        <li key={h.id} className="flex flex-wrap justify-between gap-2">
                          <span>
                            {h.paidAt ? fmtDay(h.paidAt) : "-"}
                            {diffDay && <span className="ml-1 text-slate-500">（希望 {fmtDay(h.desiredPaymentDate)}）</span>}
                          </span>
                          <span className="whitespace-nowrap text-slate-200">
                            {yen(h.paidAmount ?? h.amount)}
                            {h.paidAmount !== null && h.paidAmount !== h.amount && <span className="ml-1 text-amber-700">(申請額 {yen(h.amount)})</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {mismatch && (
                  <div className="mt-1 text-amber-700">申請額と実際の振込金額が違う履歴があります。残高と月別の充当は「申請額」で計算しています。</div>
                )}
              </details>
            </div>
          );
        })}
      </div>
    </section>
  );
}
