"use client";

import { useState } from "react";
import { InvoiceRowCard, type InvoiceRow } from "./invoice-row-card";
import type { MonthProfit } from "@/lib/month-profit";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

// 選んだ月の売上・支払い予定・粗利(送付済みの請求が対象。固定費・税金などは含まない)。
function ProfitSummary({ p }: { p: MonthProfit }) {
  const item = (label: string, value: string, sub?: string, tone = "text-[#0f172a]") => (
    <div className="rounded-xl border border-[#cbd5e1] bg-[#ffffff] px-4 py-3">
      <div className="text-xs font-bold text-[#334155]">{label}</div>
      <div className={`mt-1 text-xl font-black ${tone}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-[#475569]">{sub}</div>}
    </div>
  );
  return (
    <div className="mt-3 rounded-2xl border border-[#cbd5e1] bg-[#f1f5f9] p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {item("月の合計売上（税抜）", yen(p.salesExTax), `税込 ${yen(p.salesInclTax)}・請求${p.invoiceCount}件`)}
        {item("支払い予定金額", yen(p.payTotal), `スタッフ報酬＋経費 ${yen(p.staffPay)}・広告費 ${yen(p.adCost)}・外注費 ${yen(p.outsourcing)}`)}
        {item("粗利（税抜）", yen(p.grossProfit), "売上（税抜）− 支払い予定", p.grossProfit < 0 ? "text-[#be123c]" : "text-[#047857]")}
      </div>
      {p.staffPayUnknown.length > 0 && (
        <p className="mt-2 text-xs font-bold text-[#b45309]">報酬の金額が決まっていないスタッフがいるため、支払い予定に入っていません: {p.staffPayUnknown.join("、")}</p>
      )}
      <p className="mt-2 text-xs text-[#475569]">送付済みの請求（訂正版は最新の版）が対象です。粗利に固定費・税金などは含みません。</p>
    </div>
  );
}

// 送付済みの請求を、請求の対象月ごとにまとめて表示する。プルダウンで月を選ぶ(最初は一番新しい月)。
export function SentInvoices({ rows, profits = {} }: { rows: InvoiceRow[]; profits?: Record<string, MonthProfit> }) {
  const months = [...new Set(rows.map((r) => r.yearMonth))].sort().reverse();
  const [month, setMonth] = useState(months[0] ?? "");
  // 選んでいた月の請求が削除などでなくなったときは、一番新しい月に戻す。
  const current = month === "ALL" || months.includes(month) ? month : (months[0] ?? "");
  const shown = current === "ALL" ? rows : rows.filter((r) => r.yearMonth === current);
  const label = (ym: string) => `${ym.slice(0, 4)}年${Number(ym.slice(5))}月（${rows.filter((r) => r.yearMonth === ym).length}件）`;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-black">送付済み</h2>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-black text-slate-300">{shown.length}</span>
        <span className="text-xs text-slate-500">月を選んで表示（請求の対象月ごと）</span>
      </div>
      {months.length > 0 && (
        <select value={current} onChange={(e) => setMonth(e.target.value)} className="mt-3 rounded-xl bg-slate-800 px-3 py-2 font-bold">
          {months.map((ym) => (
            <option key={ym} value={ym}>{label(ym)}</option>
          ))}
          <option value="ALL">すべての月（{rows.length}件）</option>
        </select>
      )}
      {current !== "ALL" && profits[current] && <ProfitSummary p={profits[current]} />}
      <div className="mt-3 space-y-3">
        {shown.length === 0 && <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">送付済みの請求はまだありません。</p>}
        {shown.map((r) => (
          <InvoiceRowCard key={r.id} r={r} />
        ))}
      </div>
    </section>
  );
}
