import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { getStaffId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeMonthlyConfirmedList } from "@/lib/earnings";
import { allocateTransfersByMonth, splitTransfersByMonth } from "@/lib/transfer-allocation";
import { BottomTabBar } from "@/components/bottom-tab-bar";

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

const dateFmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" });
const dateText = (d: Date) => dateFmt.format(d);

const currentYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric" }).format(new Date()));
// "2026-10" → 今年なら「10月分」、別の年なら「2025年10月分」。
function monthText(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return y === currentYear ? `${m}月分` : `${y}年${m}月分`;
}

const COMPENSATION_LABEL: Record<string, string> = { REFERRAL: "リファラル報酬", INCENTIVE: "インセンティブ", OTHER: "その他の報酬" };
// 固定支払の「振込完了」に含めて払った別途報酬の印(admin/payments/actions.ts の markFixedPaymentDone と同じ文言)。
const INCLUDED_IN_FIXED_PAYMENT = "固定支払の振込完了に含む";

export default async function PaymentHistoryPage() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");

  // 自分のIDだけで絞る(クライアントから staff id は受け取らない)。
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { paymentMethod: true } });
  if (!staff) redirect("/");

  return (
    <main className="request-screen min-h-dvh text-slate-100">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pt-[calc(100px_+_env(safe-area-inset-top))] pb-28">
        <h1 className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-slate-700 bg-clip-text text-xl font-bold text-transparent">
          <Wallet size={20} className="text-red-500" />
          振込履歴
        </h1>
        {staff.paymentMethod === "FIXED" ? <FixedHistory staffId={staffId} /> : <RequestHistory staffId={staffId} />}
      </div>
      <BottomTabBar />
    </main>
  );
}

const card = "rounded-xl bg-gradient-to-b from-white to-slate-100 p-3 shadow-[0_2px_10px_rgba(0,0,0,0.08)]";

// ── 申請支払の人：月ごとのお支払い状況＋振込の履歴 ─────────────────────────────
async function RequestHistory({ staffId }: { staffId: string }) {
  const [months, transfers] = await Promise.all([
    computeMonthlyConfirmedList(staffId),
    // 却下は出さない。
    prisma.transferRequest.findMany({
      where: { staffId, status: { in: ["REQUESTING", "PAID"] } },
      select: { id: true, status: true, amount: true, paidAmount: true, paidAt: true, requestedAt: true, desiredPaymentDate: true },
    }),
  ]);

  const requesting = transfers.filter((t) => t.status === "REQUESTING").sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  // 振込済み(古い順)。振込日が無い古いデータは申請日で並べる。
  const paidAsc = transfers
    .filter((t) => t.status === "PAID")
    .map((t) => ({ ...t, date: t.paidAt ?? t.requestedAt }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // 月ごとの割り当ては管理画面の「振込残高」と同じ計算(申請額ベース・古い月から順に充当)。
  const monthInputs = months.map((m) => ({ yearMonth: m.yearMonth, confirmed: m.confirmed }));
  const paidByAmount = paidAsc.reduce((sum, t) => sum + t.amount, 0);
  const requestingByAmount = requesting.reduce((sum, t) => sum + t.amount, 0);
  const alloc = allocateTransfersByMonth(monthInputs, paidByAmount, requestingByAmount);
  const splits = splitTransfersByMonth(monthInputs, paidAsc.map((t) => ({ id: t.id, amount: t.amount })));

  // 実際に振り込んだ金額(記録がなければ申請額)。
  const actual = (t: { amount: number; paidAmount: number | null }) => t.paidAmount ?? t.amount;
  const receivedTotal = paidAsc.reduce((sum, t) => sum + actual(t), 0);
  const notReceived = Math.max(0, alloc.totalConfirmed - receivedTotal);

  // 合計(ここまでの合計)は振込日の古い順に累計。
  let running = 0;
  const cumulative = new Map<string, number>();
  for (const t of paidAsc) {
    running += actual(t);
    cumulative.set(t.id, running);
  }
  const paidDesc = [...paidAsc].reverse();
  const rows = alloc.rows.filter((r) => r.confirmed > 0 || r.paid > 0 || r.requesting > 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 text-slate-900">
        <div className="rounded-xl bg-emerald-50 p-3">
          <div className="text-xs text-emerald-700">お支払い済みの報酬</div>
          <div className="mt-0.5 text-xl font-bold text-emerald-700">{yen(receivedTotal)}</div>
        </div>
        <div className="rounded-xl bg-slate-100 p-3">
          <div className="text-xs text-slate-600">未払いの報酬</div>
          <div className="mt-0.5 text-xl font-bold">{yen(notReceived)}</div>
        </div>
        <p className="col-span-2 text-xs text-slate-500">確定した報酬の合計 {yen(alloc.totalConfirmed)}</p>
      </div>

      {requesting.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-700">申請中</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {requesting.map((t) => (
              <li key={t.id} className={card}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{yen(t.amount)}</span>
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700">申請中</span>
                </div>
                <div className="mt-1 text-slate-500">
                  申請日: {dateText(t.requestedAt)} / 希望日: {dateText(t.desiredPaymentDate)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-700">月ごとのお支払い状況</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">確定した報酬はまだありません。</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-200 rounded-xl bg-white text-sm shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
            {rows.map((r) => (
              <li key={r.yearMonth} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="w-24 font-semibold text-slate-900">{monthText(r.yearMonth)}</span>
                <span className="flex-1 text-slate-600">{yen(r.confirmed)}</span>
                {r.remaining === 0 && r.requesting === 0 ? (
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">振込済</span>
                ) : r.remaining === 0 ? (
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700">申請中</span>
                ) : (
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700">未払い {yen(r.remaining)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-700">振込の履歴</h2>
        {paidDesc.length === 0 ? (
          <p className="text-sm text-slate-500">振込済みの履歴はまだありません。</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {paidDesc.map((t) => {
              const parts = splits.get(t.id) ?? [];
              const differs = t.paidAmount !== null && t.paidAmount !== t.amount;
              return (
                <li key={t.id} className={card}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-bold text-slate-900">{yen(actual(t))}</span>
                    <span className="text-slate-500">{dateText(t.date)} 振込</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">ここまでの合計 {yen(cumulative.get(t.id) ?? 0)}</div>
                  {differs && <div className="mt-0.5 text-xs text-slate-500">申請額 {yen(t.amount)}</div>}
                  {parts.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                        {parts.length > 1 ? `明細を見る（${parts.length}か月分にまたがる）` : `明細を見る（${monthText(parts[0].yearMonth)}）`}
                      </summary>
                      <ul className="mt-1 rounded-lg bg-slate-100 px-2.5 py-2 text-slate-800">
                        {parts.map((p) => (
                          <li key={p.yearMonth} className="flex justify-between">
                            <span>{monthText(p.yearMonth)}</span>
                            <span>{yen(p.amount)}</span>
                          </li>
                        ))}
                        <li className="mt-1 text-[11px] text-slate-500">古い月から順に充てた目安です</li>
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

// ── 固定支払の人：月ごとの振込（受取・経費・別途報酬の内訳つき） ───────────────
async function FixedHistory({ staffId }: { staffId: string }) {
  const completions = await prisma.fixedPaymentCompletion.findMany({
    where: { staffId },
    orderBy: { closingYearMonth: "desc" },
    select: { id: true, closingYearMonth: true, paidAmount: true, paidAt: true },
  });
  const yearMonths = completions.map((c) => c.closingYearMonth);
  const [expenses, compensations] = await Promise.all([
    prisma.expense.findMany({
      where: { staffId, status: "APPROVED", yearMonth: { in: yearMonths } },
      select: { id: true, yearMonth: true, description: true, amountTaxInclusive: true },
      orderBy: { expenseDate: "asc" },
    }),
    prisma.compensationRequest.findMany({
      where: { staffId, status: "APPROVED", yearMonth: { in: yearMonths }, paidByOperatorName: INCLUDED_IN_FIXED_PAYMENT },
      select: { id: true, yearMonth: true, category: true, description: true, amountTaxInclusive: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const receivedTotal = completions.reduce((sum, c) => sum + c.paidAmount, 0);

  return (
    <>
      <div className="rounded-xl bg-emerald-50 p-3 text-slate-900">
        <div className="text-xs text-emerald-700">お支払い済みの報酬</div>
        <div className="mt-0.5 text-xl font-bold text-emerald-700">{yen(receivedTotal)}</div>
      </div>

      {completions.length === 0 ? (
        <p className="text-sm text-slate-500">振込済みの履歴はまだありません。</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {completions.map((c) => {
            const exp = expenses.filter((e) => e.yearMonth === c.closingYearMonth);
            const comp = compensations.filter((e) => e.yearMonth === c.closingYearMonth);
            const expTotal = exp.reduce((sum, e) => sum + e.amountTaxInclusive, 0);
            const compTotal = comp.reduce((sum, e) => sum + e.amountTaxInclusive, 0);
            // 稼働分 = 振込金額 − 経費 − 別途報酬(必ず合計が振込金額と一致する)。マイナスになるときは内訳を出さない。
            const earnings = c.paidAmount - expTotal - compTotal;
            const showBreakdown = earnings >= 0;
            return (
              <li key={c.id} className={card}>
                <div className="flex items-baseline justify-between">
                  <span className="text-base font-bold text-slate-900">{yen(c.paidAmount)}</span>
                  <span className="text-slate-500">{dateText(c.paidAt)} 振込</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{monthText(c.closingYearMonth)}の稼働</div>
                {showBreakdown && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-600">明細を見る</summary>
                    <ul className="mt-1 rounded-lg bg-slate-100 px-2.5 py-2 text-slate-800">
                      <li className="flex justify-between">
                        <span>稼働分</span>
                        <span>{yen(earnings)}</span>
                      </li>
                      {exp.map((e) => (
                        <li key={e.id} className="flex justify-between gap-2">
                          <span className="min-w-0 truncate">経費：{e.description ?? "経費"}</span>
                          <span className="shrink-0">{yen(e.amountTaxInclusive)}</span>
                        </li>
                      ))}
                      {comp.map((e) => (
                        <li key={e.id} className="flex justify-between gap-2">
                          <span className="min-w-0 truncate">{COMPENSATION_LABEL[e.category] ?? "別途報酬"}</span>
                          <span className="shrink-0">{yen(e.amountTaxInclusive)}</span>
                        </li>
                      ))}
                      <li className="mt-1 flex justify-between border-t border-slate-300 pt-1 font-semibold">
                        <span>合計</span>
                        <span>{yen(c.paidAmount)}</span>
                      </li>
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
