import type { AllocationResult } from "@/lib/transfer-allocation";
import { yearMonthLabel } from "@/lib/time";

// 申請支払の人ごとの「現在の振込可能額残高」と「何月稼働分がいくら振込済みか」。
// 申請は月に紐づいていないので、振込済み・申請中は古い月の確定受取から順に充当して表示している。

export type TransferBalanceView = {
  staff: { id: string; name: string; employeeCode: string };
  alloc: AllocationResult;
  monthLabels: Record<string, string>; // yearMonth → 内訳の1行要約(1日あたり/月固定など)
  paidHistory: { id: string; paidAt: Date | null; amount: number; paidAmount: number | null; desiredPaymentDate: Date }[];
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const fmtDay = (d: Date) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).format(d);

export function TransferBalanceSection({ views }: { views: TransferBalanceView[] }) {
  if (views.length === 0) return null;
  return (
    <section className="kj-data-table-panel mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-300">申請支払の人の振込残高と振込済み</h2>
      <p className="mb-3 text-xs text-slate-500">
        振込可能額残高 = 確定受取(累計) − 振込済み − 申請中。振込済み・申請中は、古い月の確定受取から順に充当して「何月稼働分か」を表示しています(申請は月ごとに分かれていないため、計算上の割り当てです)。
        経費・別途報酬は含みません。
      </p>
      <div className="space-y-4">
        {views.map((v) => {
          const a = v.alloc;
          const rows = a.rows.filter((r) => r.confirmed > 0 || r.paid > 0 || r.requesting > 0);
          const mismatch = v.paidHistory.some((h) => h.paidAmount !== null && h.paidAmount !== h.amount);
          return (
            <div key={v.staff.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="font-medium text-slate-100">
                  {v.staff.name}
                  <span className="ml-1 text-xs text-slate-500">{v.staff.employeeCode}・申請支払</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">現在の振込可能額残高</div>
                  <div className="text-2xl font-bold text-emerald-700">{yen(a.available)}</div>
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                確定受取 {yen(a.totalConfirmed)} − 振込済み {yen(a.paidTotal)} − 申請中 {yen(a.requestingTotal)} = {yen(a.available)}
              </div>
              {a.overPaid > 0 && (
                <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                  確定受取を超えて振込済み・申請中になっています(超過 {yen(a.overPaid)})。打刻漏れ・金額の入力漏れがないか確認してください。
                </div>
              )}

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="px-2 py-1.5 text-left font-medium">稼働月</th>
                      <th className="px-2 py-1.5 text-left font-medium">金額の内訳</th>
                      <th className="px-2 py-1.5 text-right font-medium">確定受取</th>
                      <th className="px-2 py-1.5 text-right font-medium">振込済み</th>
                      <th className="px-2 py-1.5 text-right font-medium">申請中</th>
                      <th className="px-2 py-1.5 text-right font-medium">未払い残</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.yearMonth} className="border-b border-slate-200">
                        <td className="whitespace-nowrap px-2 py-1.5 font-medium text-slate-100">{yearMonthLabel(r.yearMonth)}分</td>
                        <td className="px-2 py-1.5 text-xs text-slate-400">{v.monthLabels[r.yearMonth] ?? "-"}</td>
                        <td className="px-2 py-1.5 text-right">{yen(r.confirmed)}</td>
                        <td className={`px-2 py-1.5 text-right ${r.paid > 0 ? "font-semibold text-emerald-700" : "text-slate-500"}`}>{r.paid > 0 ? yen(r.paid) : "-"}</td>
                        <td className={`px-2 py-1.5 text-right ${r.requesting > 0 ? "text-amber-700 font-semibold" : "text-slate-500"}`}>{r.requesting > 0 ? yen(r.requesting) : "-"}</td>
                        <td className={`px-2 py-1.5 text-right ${r.remaining > 0 ? "font-semibold text-slate-100" : "text-slate-500"}`}>{r.remaining > 0 ? yen(r.remaining) : "-"}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2 py-3 text-center text-slate-500">
                          確定した受取がありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {rows.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-slate-600 font-semibold text-slate-100">
                        <td className="px-2 py-1.5" colSpan={2}>
                          合計
                        </td>
                        <td className="px-2 py-1.5 text-right">{yen(a.totalConfirmed)}</td>
                        <td className="px-2 py-1.5 text-right">{yen(a.rows.reduce((s, r) => s + r.paid, 0))}</td>
                        <td className="px-2 py-1.5 text-right">{yen(a.rows.reduce((s, r) => s + r.requesting, 0))}</td>
                        <td className="px-2 py-1.5 text-right">{yen(a.rows.reduce((s, r) => s + r.remaining, 0))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <div className="mt-3 text-xs text-slate-400">
                <div className="mb-1 font-semibold text-slate-300">振込済みの履歴</div>
                {v.paidHistory.length === 0 ? (
                  <div className="text-slate-500">まだ振込済みがありません</div>
                ) : (
                  <ul className="space-y-0.5">
                    {v.paidHistory.map((h) => (
                      <li key={h.id} className="flex flex-wrap justify-between gap-2">
                        <span>
                          振込日 {h.paidAt ? fmtDay(h.paidAt) : "-"}(希望振込日 {fmtDay(h.desiredPaymentDate)})
                        </span>
                        <span className="whitespace-nowrap text-slate-200">
                          振込金額 {yen(h.paidAmount ?? h.amount)}
                          {h.paidAmount !== null && h.paidAmount !== h.amount && <span className="ml-1 text-amber-700">(申請額 {yen(h.amount)})</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {mismatch && (
                  <div className="mt-1 text-xs text-amber-700">
                    申請額と実際の振込金額が違う履歴があります。残高と月別の充当は「申請額」で計算しています。
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
