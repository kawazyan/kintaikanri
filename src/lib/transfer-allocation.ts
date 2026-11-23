// 申請支払の人の「振込済み・申請中」を、古い月の確定受取から順に充当して、月ごとに割り振る(純粋な関数。DBに触れない)。
// 申請(TransferRequest)は月に紐づいていないので、「何月稼働分」は計算で決める。
//  1) 振込済みの合計を、古い月から順に埋める
//  2) 申請中の合計を、残りの枠に古い月から順に埋める
// 残高 = 確定受取の合計 − 振込済み − 申請中(0未満は0)。computeTransferBalance と同じ式。

export type MonthConfirmed = { yearMonth: string; confirmed: number };

export type MonthAllocation = {
  yearMonth: string;
  confirmed: number; // その月の確定受取
  paid: number; // うち振込済みに充当された額
  requesting: number; // うち申請中に充当された額
  remaining: number; // 未払い(= confirmed − paid − requesting)
};

export type AllocationResult = {
  rows: MonthAllocation[]; // 古い月 → 新しい月
  totalConfirmed: number;
  paidTotal: number;
  requestingTotal: number;
  available: number; // 現在の振込可能額残高
  overPaid: number; // 確定受取を超えて振込済み・申請中になっている額(通常は0)
};

export function allocateTransfersByMonth(months: MonthConfirmed[], paidTotal: number, requestingTotal: number): AllocationResult {
  const sorted = [...months].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  const rows: MonthAllocation[] = sorted.map((m) => ({ yearMonth: m.yearMonth, confirmed: m.confirmed, paid: 0, requesting: 0, remaining: m.confirmed }));

  let paidLeft = paidTotal;
  for (const r of rows) {
    const take = Math.min(r.remaining, paidLeft);
    r.paid = take;
    r.remaining -= take;
    paidLeft -= take;
  }
  let reqLeft = requestingTotal;
  for (const r of rows) {
    const take = Math.min(r.remaining, reqLeft);
    r.requesting = take;
    r.remaining -= take;
    reqLeft -= take;
  }

  const totalConfirmed = rows.reduce((sum, r) => sum + r.confirmed, 0);
  return {
    rows,
    totalConfirmed,
    paidTotal,
    requestingTotal,
    available: Math.max(0, totalConfirmed - paidTotal - requestingTotal),
    overPaid: paidLeft + reqLeft,
  };
}
