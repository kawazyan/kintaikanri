import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "../admin-nav";
import { markCompensationPaid, reviewCompensationRequest, undoCompensationPaid } from "./actions";
import { ConfirmButton } from "./confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { formatJst, yearMonthLabel } from "@/lib/time";

// 管理画面は明るい配色(.admin-theme)。暗い配色用のクラスは白背景だと濁るので、ここでは色を直接指定する。
const INK = "text-[#1e293b]";
const MUTED = "text-[#475569]";
const INPUT = "rounded-lg border border-[#94a3b8] bg-white px-3 py-2 text-sm text-[#1e293b] placeholder:!text-[#64748b]";

const categoryLabel = (c: string) => (c === "REFERRAL" ? "リファラル報酬" : c === "INCENTIVE" ? "インセンティブ" : "その他");
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

type Item = Awaited<ReturnType<typeof loadItems>>[number];

async function loadItems() {
  return prisma.compensationRequest.findMany({
    include: { staff: true, items: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

function StatusPill({ x }: { x: Item }) {
  const base = "rounded-full border px-3 py-0.5 text-xs font-bold";
  if (x.status === "APPROVED" && x.paidAt) return <span className={`${base} border-[#34d399] bg-[#ecfdf5] text-[#047857]`}>振込済み</span>;
  if (x.status === "APPROVED") return <span className={`${base} border-[#f59e0b] bg-[#fffbeb] text-[#92400e]`}>承認済み・未振込</span>;
  if (x.status === "SUBMITTED") return <span className={`${base} border-[#60a5fa] bg-[#eff6ff] text-[#1d4ed8]`}>確認待ち</span>;
  if (x.status === "REJECTED") return <span className={`${base} border-[#cbd5e1] bg-[#f1f5f9] text-[#475569]`}>却下</span>;
  return <span className={`${base} border-[#cbd5e1] bg-[#f1f5f9] text-[#475569]`}>下書き</span>;
}

function Card({ x }: { x: Item }) {
  return (
    <article className="rounded-2xl border-2 border-[#cbd5e1] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-lg font-extrabold ${INK}`}>
            {x.staff.name}
            <span className="ml-2 text-sm font-bold text-[#475569]">
              {categoryLabel(x.category)} ・ {yearMonthLabel(x.yearMonth)}
            </span>
          </p>
          <p className={`mt-1 text-xs ${MUTED}`}>{x.submittedAt ? `${formatJst(x.submittedAt).slice(0, 16)} 申請` : ""}</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-extrabold ${INK}`}>{yen(x.amountTaxInclusive)}</p>
          <p className={`text-[11px] ${MUTED}`}>
            税抜 {yen(x.amountExTax)} / 税 {yen(x.taxAmount)}
          </p>
          <div className="mt-1">
            <StatusPill x={x} />
          </div>
        </div>
      </div>

      {x.items.length > 0 && (
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#cbd5e1] text-xs text-[#475569]">
              <th className="py-1 pr-3 font-bold">対象</th>
              <th className="py-1 pr-3 text-right font-bold">金額</th>
              <th className="py-1 font-bold">メモ</th>
            </tr>
          </thead>
          <tbody className={INK}>
            {x.items.map((it) => (
              <tr key={it.id} className="border-b border-[#e2e8f0] align-top">
                <td className="py-1.5 pr-3 font-bold">{it.label}</td>
                <td className="py-1.5 pr-3 text-right font-bold whitespace-nowrap">{yen(it.amount)}</td>
                <td className="py-1.5 text-xs whitespace-pre-line text-[#475569]">{it.memo ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {x.description && (
        <div className="mt-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-3">
          <p className="text-[11px] font-bold text-[#475569]">{x.items.length > 0 ? "全体のメモ" : "スタッフが入力した内訳"}</p>
          <p className={`mt-1 text-sm leading-relaxed whitespace-pre-line ${INK}`}>{x.description}</p>
        </div>
      )}

      {x.reviewedAt && (
        <p className={`mt-2 text-xs ${MUTED}`}>
          {formatJst(x.reviewedAt).slice(0, 16)} 確認{x.reviewerName ? `(${x.reviewerName})` : ""}
          {x.reviewNote ? ` / ${x.reviewNote}` : ""}
        </p>
      )}

      {x.status === "SUBMITTED" && (
        <form className="mt-4 grid gap-2 md:grid-cols-[1fr_160px_1fr_auto_auto]">
          <input name="reviewerName" required placeholder="確認者名" className={INPUT} />
          <input name="amountTaxInclusive" type="number" defaultValue={x.amountTaxInclusive} className={INPUT} />
          <input name="reviewNote" placeholder="確認メモ" className={INPUT} />
          <button formAction={reviewCompensationRequest.bind(null, x.id, "APPROVED")} className="rounded-lg bg-[#047857] px-4 py-2 text-sm font-extrabold text-white">
            承認
          </button>
          <button formAction={reviewCompensationRequest.bind(null, x.id, "REJECTED")} className="rounded-lg bg-[#b91c1c] px-4 py-2 text-sm font-extrabold text-white">
            却下
          </button>
        </form>
      )}

      {x.status === "APPROVED" && !x.paidAt && (
        <form action={markCompensationPaid.bind(null, x.id)} className="mt-4 grid gap-2 border-t border-[#e2e8f0] pt-3 md:grid-cols-[1fr_230px_auto]">
          <input name="operatorName" placeholder="処理者名(任意)" className={INPUT} />
          <input name="paidAmount" type="number" min={1} placeholder={`振込額(空欄=${x.amountTaxInclusive.toLocaleString("ja-JP")}円)`} className={INPUT} />
          <SubmitButton className="rounded-lg bg-[#1d4ed8] px-5 py-2 text-sm font-extrabold text-white">振込済みにする</SubmitButton>
        </form>
      )}

      {x.paidAt && (
        <form action={undoCompensationPaid.bind(null, x.id)} className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8f0] pt-3">
          <p className="text-sm font-bold text-[#047857]">
            {formatJst(x.paidAt).slice(0, 16)} 振込済み {x.paidAmount != null ? yen(x.paidAmount) : ""}
            {x.paidByOperatorName ? `(処理者: ${x.paidByOperatorName})` : ""}
          </p>
          <ConfirmButton message={`${x.staff.name}さんの振込済みの記録を取り消して、未振込に戻します。よろしいですか?`} className="rounded-lg border border-[#94a3b8] px-3 py-1 text-xs font-bold text-[#475569]">
            振込済みを取り消す
          </ConfirmButton>
        </form>
      )}
    </article>
  );
}

export default async function AdminCompensationRequests() {
  await requireAdmin();
  const items = await loadItems();

  const waiting = items.filter((x) => x.status === "APPROVED" && !x.paidAt);
  const review = items.filter((x) => x.status === "SUBMITTED");
  const paid = items.filter((x) => x.status === "APPROVED" && x.paidAt);
  const other = items.filter((x) => x.status !== "APPROVED" && x.status !== "SUBMITTED");
  const waitingTotal = waiting.reduce((sum, x) => sum + x.amountTaxInclusive, 0);

  const Section = ({ title, note, list }: { title: string; note?: string; list: Item[] }) =>
    list.length === 0 ? null : (
      <section className="mt-8">
        <h2 className={`text-base font-extrabold ${INK}`}>
          {title}({list.length}件)
        </h2>
        {note && <p className={`mt-1 text-sm font-bold ${MUTED}`}>{note}</p>}
        <div className="mt-3 space-y-3">
          {list.map((x) => (
            <Card key={x.id} x={x} />
          ))}
        </div>
      </section>
    );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <AdminNav />
      <h1 className={`text-2xl font-extrabold ${INK}`}>別途報酬申請</h1>
      <p className={`mt-1 text-sm ${MUTED}`}>リファラル報酬・インセンティブなど。申請 → 承認 → 振込済み の順に進めます。</p>

      <Section title="振込待ち(承認済み・未振込)" note={`合計 ${yen(waitingTotal)}`} list={waiting} />
      <Section title="確認待ち(申請中)" list={review} />
      <Section title="振込済み" list={paid} />
      <Section title="却下・下書き" list={other} />
      {items.length === 0 && <p className={`mt-6 text-sm ${MUTED}`}>別途報酬申請はまだありません。</p>}
    </main>
  );
}
