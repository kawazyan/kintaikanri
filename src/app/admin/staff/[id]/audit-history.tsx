import { AUDIT_CATEGORY_LABEL, type AuditRow } from "@/lib/audit";

// スタッフ詳細ページの「変更履歴」(振込・金額設定・経費・別途報酬)。新しい順。
const BADGE: Record<string, string> = {
  TRANSFER: "bg-[#dbeafe] text-[#1e3a8a]",
  AMOUNT_SETTING: "bg-[#fef3c7] text-[#92400e]",
  EXPENSE: "bg-[#dcfce7] text-[#166534]",
  COMPENSATION: "bg-[#fce7f3] text-[#9d174d]",
};

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

export function AuditHistory({ data }: { data: { rows: AuditRow[]; total: number } | null }) {
  return (
    <section className="mb-6 rounded-2xl border border-[#cbd5e1] bg-[#ffffff] p-3 text-[#0f172a]">
      <h2 className="text-sm font-bold text-[#1e3a8a]">変更履歴（振込・金額設定・経費・別途報酬）</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-[#475569]">
        誰が・いつ・何を変えたかの記録です。管理者の操作は、変更するときに入力した操作者名が残ります（空欄のときは「名前なし」）。スタッフ本人の申請は本人の名前が自動で残ります。
      </p>
      {data === null ? (
        <p className="mt-2 rounded-lg bg-[#fef2f2] px-2 py-1.5 text-xs font-semibold text-[#b91c1c]">変更履歴を読み込めませんでした。</p>
      ) : data.rows.length === 0 ? (
        <p className="mt-2 text-xs text-[#475569]">まだ履歴はありません。</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-[#e2e8f0]">
            {data.rows.map((r) => (
              <li key={r.id} className="py-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#475569]">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${BADGE[r.category] ?? "bg-[#e2e8f0] text-[#334155]"}`}>
                    {AUDIT_CATEGORY_LABEL[r.category] ?? r.category}
                  </span>
                  <span className="font-semibold text-[#0f172a]">{fmt(r.createdAt)}</span>
                  <span>
                    操作者:{" "}
                    <b className={r.actorType === "ADMIN" && !r.actorName ? "text-[#b45309]" : "text-[#0f172a]"}>
                      {r.actorType === "STAFF" ? `${r.actorName ?? "本人"}(本人)` : (r.actorName ?? "名前なし")}
                    </b>
                  </span>
                </div>
                <div className="mt-1 text-sm leading-snug text-[#0f172a]">{r.summary}</div>
              </li>
            ))}
          </ul>
          {data.total > data.rows.length && (
            <p className="mt-2 text-[11px] text-[#475569]">新しい{data.rows.length}件を表示しています（全{data.total}件）。</p>
          )}
        </>
      )}
    </section>
  );
}
