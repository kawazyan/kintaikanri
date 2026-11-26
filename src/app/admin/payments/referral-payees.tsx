import { OperatorNameInput } from "@/components/operator-name-input";
import { markPayeePaid, undoPayeePaid } from "./payee-actions";
import type { PayeeRow } from "@/lib/referral-payee";

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
const monthText = (ym: string) => `${Number(ym.slice(5))}月`;
const dateText = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const jstDate = (d: Date) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

// リファラルのみの人(スタッフ登録なし)への支払い。未払いは全部、払い済みは選んだ月に払ったものだけ出す。
export function ReferralPayeeSection({ rows, yearMonth, today }: { rows: PayeeRow[]; yearMonth: string; today: string }) {
  const unpaid = rows.filter((r) => !r.paid);
  const paidThisMonth = rows.filter((r) => r.paid && r.dueMonth === yearMonth);
  const people = [...new Set([...unpaid, ...paidThisMonth].map((r) => r.payeeName))];
  if (!people.length) return null;
  const unpaidTotal = unpaid.reduce((a, r) => a + (r.amount ?? 0), 0);

  return (
    <section className="mt-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-300">リファラルのみの人への支払い</h2>
      <p className="mb-3 text-xs text-slate-500">
        スタッフ登録のない紹介者への支払いです。支払い日は、稼働月の翌月末（松浦さん）・翌々月末（十河さん）です。
        {unpaid.some((r) => r.amount !== null) && <> 未払い合計 {yen(unpaidTotal)}（計算できているものだけ）。</>}
      </p>
      <div className="space-y-4">
        {people.map((name) => {
          const mine = [...unpaid, ...paidThisMonth].filter((r) => r.payeeName === name);
          return (
            <div key={name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 font-medium text-slate-100">{name}さん</div>
              <ul className="space-y-3">
                {mine.map((r) => {
                  const overdue = !r.paid && r.dueDate < today;
                  return (
                    <li key={`${r.ruleId}-${r.workMonth}`} className="rounded-lg bg-white p-3 text-sm text-slate-900 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">
                            {monthText(r.workMonth)}稼働分　{r.label}
                          </div>
                          <div className={`text-xs ${overdue ? "font-semibold text-red-600" : "text-slate-500"}`}>
                            支払い期限 {dateText(r.dueDate)}
                            {overdue && "（過ぎています）"}
                          </div>
                        </div>
                        <div className="text-right">
                          {r.amount !== null ? <div className="text-lg font-bold">{yen(r.amount)}</div> : <div className="text-sm text-slate-500">計算待ち</div>}
                          {r.paid && <div className="text-xs font-semibold text-emerald-700">振込済（{dateText(jstDate(r.paid.paidAt))}）</div>}
                        </div>
                      </div>

                      {r.pendingReason && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">{r.pendingReason}</p>}

                      {r.lines.length > 0 && (
                        <ul className="mt-2 divide-y divide-slate-100 rounded bg-slate-50 px-2 text-xs">
                          {r.lines.map((l, i) => (
                            <li key={i} className={`flex justify-between gap-2 py-1 ${l.kind === "result" ? "font-bold" : ""} ${l.kind === "note" ? "text-slate-500" : ""}`}>
                              <span>{l.kind === "minus" ? "− " : l.kind === "plus" ? "" : ""}{l.label}</span>
                              {l.kind !== "note" && <span>{yen(l.amount)}</span>}
                            </li>
                          ))}
                        </ul>
                      )}

                      {!r.paid && r.amount !== null && (
                        <form action={markPayeePaid.bind(null, r.ruleId, r.workMonth)} className="mt-2 flex items-center gap-2">
                          <OperatorNameInput className="w-28 rounded border border-slate-300 px-2 py-1 text-xs" />
                          <button type="submit" className="rounded bg-slate-800 px-3 py-1 text-xs font-bold text-white">振込完了</button>
                        </form>
                      )}
                      {r.paid && (
                        <form action={undoPayeePaid.bind(null, r.ruleId, r.workMonth)} className="mt-2">
                          <button type="submit" className="text-xs text-slate-500 underline">振込完了を取り消す</button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
