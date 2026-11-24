import type { EarningsDetail } from "@/lib/earnings";

// 受取金額の内訳を、画面に出す文章にする(純粋な関数。DBに触れない)。

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

// 画面に出す内訳の1行(ラベルと数字)。strong=その区分の結果の行(太字・上に線)。
export type DescRow = { label: string; value: string; note?: string; strong?: boolean };

export type EarningsDescription = {
  modeLabel: string; // 「1日あたり」「月固定」など
  rows: DescRow[]; // 計算の流れ(1行ずつ)
  short: string; // 1行の要約(月別の一覧用)
};

export function describeEarnings(d: EarningsDetail): EarningsDescription {
  const rows: DescRow[] = [];
  let modeLabel = "単価指定";
  let short = "";

  if (d.mode === "MANUAL") {
    return { modeLabel: "手入力", rows: [{ label: "その月の金額(管理者が入力)", value: yen(d.mainAmount), strong: true }], short: "手入力" };
  }

  if (d.mode === "DAILY") {
    modeLabel = "1日あたり";
    const rate = d.rate ?? 0;
    // 日当 × 日数。日当が0のときだけ確定日数をそのまま出す(0除算を避ける)。
    const days = rate > 0 ? d.mainAmount / rate : d.days;
    rows.push({ label: "日当(1日あたり)", value: yen(rate) });
    rows.push({ label: "稼働日数", value: `${days}日` });
    rows.push({ label: "日当 × 稼働日数", value: `${yen(rate)} × ${days}日 = ${yen(d.mainAmount)}`, strong: true });
    short = `1日あたり ${yen(rate)} × ${days}日`;
  } else if (d.mode === "MONTHLY") {
    modeLabel = "月固定";
    if (d.baseAmount !== null && d.plannedDays !== null && d.rate !== null) {
      rows.push({ label: "月額(月固定)", value: yen(d.baseAmount) });
      rows.push({ label: "予定日数", value: `${d.plannedDays}日` });
      rows.push({ label: "1日あたり", value: yen(d.rate), note: "月額 ÷ 予定日数" });
      rows.push({ label: "出勤日数", value: `${d.days}日`, note: d.fullAttendance ? "欠勤なし" : "欠勤あり(日割りで減額)" });
      rows.push({
        label: d.fullAttendance ? "満額" : "1日あたり × 出勤日数",
        value: d.fullAttendance ? yen(d.mainAmount) : `${yen(d.rate)} × ${d.days}日 = ${yen(d.mainAmount)}`,
        strong: true,
      });
      short = `月固定 ${yen(d.baseAmount)} / 出勤${d.days}日・予定${d.plannedDays}日`;
    } else if (d.baseAmount !== null) {
      rows.push({ label: "月額(月固定)", value: yen(d.baseAmount), note: "稼働日数に関わらず月1回", strong: true });
      short = `月固定 ${yen(d.baseAmount)}`;
    }
  }

  if (d.ownCount > 0) {
    rows.push({ label: "単価指定のシフト", value: `${d.ownCount}日 = ${yen(d.ownAmountTotal)}` });
    short = short ? `${short} ＋単価指定${d.ownCount}日` : `単価指定 ${d.ownCount}日`;
  }
  if (d.travelAmount > 0 && d.travelPerDay > 0) {
    rows.push({ label: "交通費(自動加算)", value: `${yen(d.travelPerDay)} × ${d.travelAmount / d.travelPerDay}日 = ${yen(d.travelAmount)}` });
  }
  // 日当・月額のほかに加算(単価指定・交通費)があるときだけ、受取の合計の行を足す。
  if (d.ownCount > 0 || d.travelAmount > 0) {
    rows.push({ label: "受取 合計", value: yen(d.mainAmount + d.ownAmountTotal + d.travelAmount), strong: true });
  }
  if (!short) short = "単価指定";
  return { modeLabel, rows, short };
}
