import { prisma } from "@/lib/prisma";
import { amountEntryOf } from "@/lib/amount-entry";
import { AmountEntryForm } from "./entry-form";

export const metadata = { title: "金額入力", robots: { index: false, follow: false } };

const TZ = "Asia/Tokyo";
const fmtDay = (d: Date) => d.toLocaleDateString("ja-JP", { timeZone: TZ, month: "numeric", day: "numeric", weekday: "short" });
const fmtTime = (d: Date) => d.toLocaleTimeString("ja-JP", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const fmtDateTime = (d: Date) => d.toLocaleString("ja-JP", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

// 対象月の前後の月(日本時間基準)。
function monthOptions() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const out: string[] = [];
  for (let k = -2; k <= 1; k++) out.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + k, 1)).toISOString().slice(0, 7));
  return out;
}

const cardClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const thClass = "border-b border-slate-200 px-2 py-2 text-left text-xs font-bold text-slate-600";
const tdClass = "border-b border-slate-100 px-2 py-2 text-sm text-slate-900";

// 取引先ごとの専用リンク。合言葉(token)が一致しなければ、取引先名も稼働も表示しない。
export default async function AmountEntryPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ m?: string }> }) {
  const { token } = await params;
  const { m } = await searchParams;
  const clients = await prisma.client.findMany({ select: { id: true, name: true, billingTerms: true } });
  const client = clients.find((c) => amountEntryOf(c.billingTerms)?.token === token);
  const entry = client ? amountEntryOf(client.billingTerms) : null;
  if (!client || !entry) {
    return (
      <div className="admin-theme min-h-dvh">
        <main className="mx-auto max-w-md px-4 py-10">
          <h1 className="kj-page-title">このリンクは無効です</h1>
          <p className="mt-3 text-sm text-slate-700">管理者に確認してください。</p>
        </main>
      </div>
    );
  }

  const options = monthOptions();
  const month = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : options[2];
  const [y, mo] = month.split("-").map(Number);
  const start = new Date(`${month}-01T00:00:00+09:00`);
  const end = new Date(`${new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7)}-01T00:00:00+09:00`);

  // この取引先の稼働者(設定のスタッフ)の、対象月のシフトと打刻だけを出す。
  const shifts = entry.staffId
    ? await prisma.shift.findMany({
        where: { staffId: entry.staffId, startTime: { gte: start, lt: end } },
        include: { clockRecords: { orderBy: { timestamp: "asc" } } },
        orderBy: { startTime: "asc" },
      })
    : [];
  const rows = shifts.map((s) => {
    const ins = s.clockRecords.filter((r) => r.type === "IN");
    const outs = s.clockRecords.filter((r) => r.type === "OUT");
    return {
      id: s.id,
      day: fmtDay(s.startTime),
      store: s.storeName,
      planned: `${fmtTime(s.startTime)}〜${fmtTime(s.endTime)}`,
      inAt: ins[0] ? fmtTime(ins[0].timestamp) : "—",
      outAt: outs.length ? fmtTime(outs[outs.length - 1].timestamp) : "—",
      cancelled: !!s.cancelledAt,
    };
  });

  const sent = await prisma.invoice.findMany({
    where: { clientId: client.id, sentAt: { not: null } },
    select: { yearMonth: true, subtotalExTax: true, totalInclTax: true, sentAt: true },
    orderBy: { sentAt: "desc" },
    take: 12,
  });

  return (
    <div className="admin-theme min-h-dvh">
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="kj-page-title">{client.name}</h1>
        <p>金額を入力して送信すると、請求書がすぐ取引先へ届きます。送信は取り消せません。</p>

        <section className={`${cardClass} mt-5`}>
          <h2 className="text-base font-black text-slate-900">金額を入力して送信</h2>
          <div className="mt-4">
            <AmountEntryForm token={token} months={options} defaultMonth={month} />
          </div>
        </section>

        <section className={`${cardClass} mt-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-black text-slate-900">{y}年{mo}月の稼働</h2>
            <nav className="flex flex-wrap gap-2 text-sm">
              {options.map((o) => (
                <a key={o} href={`?m=${o}`} className={`rounded-full px-3 py-1 font-bold ${o === month ? "bg-[#172033] text-white" : "bg-slate-100 text-slate-700"}`}>
                  {o.slice(5).replace(/^0/, "")}月
                </a>
              ))}
            </nav>
          </div>
          {!entry.staffId ? (
            <p className="mt-4 text-sm text-slate-600">稼働の表示が設定されていません。管理者に確認してください。</p>
          ) : rows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">この月の稼働はありません。</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse">
                <thead>
                  <tr>
                    <th className={thClass}>日付</th>
                    <th className={thClass}>稼働店舗</th>
                    <th className={thClass}>予定</th>
                    <th className={thClass}>出勤</th>
                    <th className={thClass}>退勤</th>
                    <th className={thClass}>状態</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className={tdClass}>{r.day}</td>
                      <td className={tdClass}>{r.store}</td>
                      <td className={tdClass}>{r.planned}</td>
                      <td className={tdClass}>{r.inAt}</td>
                      <td className={tdClass}>{r.outAt}</td>
                      <td className={tdClass}>{r.cancelled ? <span className="font-bold text-red-700">取消</span> : "稼働"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-sm font-bold text-slate-800">稼働日数: {rows.filter((r) => !r.cancelled).length}日</p>
            </div>
          )}
        </section>

        <section className={`${cardClass} mt-5`}>
          <h2 className="text-base font-black text-slate-900">送信済みの請求</h2>
          {sent.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">まだ送信した請求はありません。</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse">
                <thead>
                  <tr>
                    <th className={thClass}>対象月</th>
                    <th className={thClass}>税抜</th>
                    <th className={thClass}>税込</th>
                    <th className={thClass}>送信日時</th>
                  </tr>
                </thead>
                <tbody>
                  {sent.map((i) => (
                    <tr key={`${i.yearMonth}-${i.sentAt?.toISOString()}`}>
                      <td className={tdClass}>{i.yearMonth.replace("-", "年")}月</td>
                      <td className={tdClass}>{yen(i.subtotalExTax)}</td>
                      <td className={tdClass}>{yen(i.totalInclTax)}</td>
                      <td className={tdClass}>{i.sentAt ? fmtDateTime(i.sentAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
