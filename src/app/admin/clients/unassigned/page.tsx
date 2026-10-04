import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadRuleIndex } from "@/lib/client-shifts";
import { jstMonthRange, toJstDateValue } from "@/lib/time";
import { normalizeYearMonth } from "@/lib/client-view";
import { AdminNav } from "../../admin-nav";

export const dynamic = "force-dynamic";

// 契約(早見表)でクライアントが決まらないシフトの一覧。0社=どの契約にも当てはまらない / 2社以上=自動では決められない。
export default async function UnassignedPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const { month } = await searchParams;
  const yearMonth = normalizeYearMonth(month);
  const { start, end } = jstMonthRange(yearMonth);
  const [shifts, staff, index] = await Promise.all([
    prisma.shift.findMany({
      where: { startTime: { gte: start, lt: end }, workOrderStaffId: null },
      select: { staffId: true, storeName: true, startTime: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.staff.findMany({ select: { id: true, name: true } }),
    loadRuleIndex(yearMonth),
  ]);
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  const clientName = new Map(index.clients.map((c) => [c.id, c.name]));

  type Row = { staff: string; store: string; dates: string[]; owners: string[] };
  const groups = new Map<string, Row>();
  for (const s of shifts) {
    const name = nameOf.get(s.staffId) ?? "(不明)";
    const date = toJstDateValue(s.startTime);
    const owners = index.owners(name, s.storeName, date);
    if (owners.length === 1) continue;
    const key = `${name}|${s.storeName}|${owners.join(",")}`;
    const g = groups.get(key) ?? { staff: name, store: s.storeName, dates: [], owners };
    g.dates.push(date.slice(5).replace("-", "/"));
    groups.set(key, g);
  }
  const rows = [...groups.values()];
  const conflicts = rows.filter((r) => r.owners.length >= 2);
  const none = rows.filter((r) => r.owners.length === 0);

  const [y, m] = yearMonth.split("-").map(Number);
  const shift = (d: number) => { const n = new Date(Date.UTC(y, m - 1 + d, 1)); return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`; };

  const renderTable = (title: string, list: Row[], note: string) => <section className="mt-6">
    <h2 className="text-lg font-black">{title}<span className="ml-2 text-sm text-slate-400">{list.length}組</span></h2>
    <p className="mt-1 text-xs font-bold text-slate-500">{note}</p>
    <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs font-black text-slate-500"><tr><th className="px-4 py-3">スタッフ</th><th className="px-4 py-3">店舗名</th><th className="px-4 py-3">日付</th><th className="px-4 py-3">当てはまる契約</th></tr></thead>
        <tbody>{list.length === 0 && <tr><td colSpan={4} className="px-4 py-5 text-center font-bold text-slate-400">ありません</td></tr>}
          {list.map((r, i) => <tr key={i} className="border-t border-slate-100 align-top">
            <td className="px-4 py-3 font-black">{r.staff}</td><td className="px-4 py-3 font-bold">{r.store}</td>
            <td className="px-4 py-3 font-bold">{r.dates.join("、")}</td>
            <td className="px-4 py-3 font-bold">{r.owners.length ? r.owners.map((o) => clientName.get(o) ?? o).join(" / ") : "なし"}</td></tr>)}</tbody></table>
    </div></section>;

  return <main className="mx-auto max-w-6xl px-4 py-8 text-slate-900"><AdminNav />
    <Link href="/admin/clients" className="text-sm font-black text-slate-500 underline">← 取引先・依頼窓口へ戻る</Link>
    <div className="mt-3 rounded-[28px] bg-[#14283b] p-6 text-white">
      <p className="text-[11px] font-black tracking-[.18em] text-slate-300">UNASSIGNED SHIFTS</p>
      <h1 className="mt-2 text-2xl font-black">クライアントが決まらないシフト</h1>
      <p className="mt-2 text-sm font-bold text-slate-300">契約(早見表)に当てはまらない、または2社以上に当てはまるシフトです。請求にも閲覧ページにも含まれません。契約の店舗名などを見直してください。</p>
      <div className="mt-4 flex gap-2 text-sm font-black"><Link href={`?month=${shift(-1)}`} className="rounded-xl bg-white/15 px-3 py-1.5">← 前月</Link><span className="px-2 py-1.5">{y}年{m}月</span><Link href={`?month=${shift(1)}`} className="rounded-xl bg-white/15 px-3 py-1.5">翌月 →</Link></div>
    </div>
    {renderTable("2社以上に当てはまる(要確認)", conflicts, "同じスタッフ・店舗が複数の契約に当てはまっています。契約の店舗名・期間を分けてください。")}
    {renderTable("どの契約にも当てはまらない", none, "契約が未登録、または店舗名の表記が契約と合っていない可能性があります。")}
  </main>;
}
