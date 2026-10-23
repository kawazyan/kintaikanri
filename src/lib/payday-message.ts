// 振込日の通知文(純粋なロジック。DB・LINEに触れない)。

export type PaydayItem = {
  kind: "FIXED" | "REQUEST";
  staffId?: string;
  closingYearMonth?: string; // 固定支払の対象の締め月(YYYY-MM)
  name: string;
  amount: number | null; // null=金額を出せない
  note?: string; // 例: 「9月分」「締日が月末以外のため金額は未計算」
};

const nameOf = (n: string) => n.replace(/[\s　]+/g, " ");
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

// 通知の文面(純粋な関数)。同じ日の複数人を1つのメッセージにまとめる。
export function paydayMessage(dateLabel: string, items: PaydayItem[], paymentsUrl: string) {
  const line = (i: PaydayItem) => `・${nameOf(i.name)} ${i.amount === null ? "金額未確定" : yen(i.amount)}${i.note ? `（${i.note}）` : ""}`;
  const fixed = items.filter((i) => i.kind === "FIXED");
  const request = items.filter((i) => i.kind === "REQUEST");
  const known = items.filter((i) => i.amount !== null);
  const total = known.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  return [
    `【本日の振込日】${dateLabel}`,
    `${items.length}名`,
    ...(fixed.length ? ["", "■固定支払", ...fixed.map(line)] : []),
    ...(request.length ? ["", "■申請支払（希望振込日）", ...request.map(line)] : []),
    "",
    `合計 ${yen(total)}${known.length < items.length ? "（金額未確定の分を除く）" : ""}`,
    `振込申請一覧: ${paymentsUrl}`,
  ].join("\n");
}

