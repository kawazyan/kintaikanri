"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveInvoiceEdit, type InvoiceEditPayload } from "../../actions";

type Initial = {
  addressee: string;
  subject: string;
  note: string;
  amountExTax: number;
  hasStatement: boolean;
  warnings: string[];
  clientExtras: { label: string; amountExTax: number; calc: string; store?: string; period?: string }[];
  staff: {
    name: string;
    places: string;
    carriers: string;
    dates: string[];
    dayPlaces: Record<string, string>;
    serviceExTax: number;
    serviceCalc: string;
    travelInclTax: number;
    extrasExTax: number;
    extrasLabel: string;
  }[];
};

const input = "w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100";

// 数字の入力欄。消して打ち直すときに、先頭へ「0」が自動で付かない(空欄にできる)。
// 空欄のまま確定(フォーカスを外す)したときだけ 0 に戻す。
function NumInput({ value, onChange, className }: { value: number; onChange: (n: number) => void; className?: string }) {
  const [text, setText] = useState(String(value));
  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
        setText(digits);
        onChange(digits === "" ? 0 : Number(digits));
      }}
      onBlur={() => text === "" && setText("0")}
      className={className}
    />
  );
}

export function EditInvoiceForm({
  invoiceId,
  recipients,
  initial,
  yearMonth,
  status,
}: {
  invoiceId: string;
  recipients: string;
  status: "DRAFT" | "APPROVED";
  initial: Initial;
  yearMonth: string;
}) {
  const router = useRouter();
  const [addressee, setAddressee] = useState(initial.addressee);
  const [subject, setSubject] = useState(initial.subject);
  const [note, setNote] = useState(initial.note);
  const [amount, setAmount] = useState(initial.amountExTax);
  const [staff, setStaff] = useState(initial.staff);
  const [extras, setExtras] = useState(initial.clientExtras);
  const [approver, setApprover] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // 請求書は「業務委託費一式」1行。金額は稼働明細書の合計(業務委託費＋交通費相当額＋その他)。
  const travelEx = (incl: number) => (incl > 0 ? Math.floor((incl * 100) / 110) : 0);
  const subtotal = initial.hasStatement
    ? staff.reduce((sum, st) => sum + (Number(st.serviceExTax) || 0) + travelEx(Number(st.travelInclTax) || 0) + st.extrasExTax, 0) +
      extras.reduce((sum, e) => sum + (Number(e.amountExTax) || 0), 0)
    : Number(amount) || 0;
  const tax = Math.floor((subtotal * 10) / 100);

  function payload(): InvoiceEditPayload {
    return {
      addressee,
      subject,
      note,
      amountExTax: initial.hasStatement ? undefined : Number(amount),
      clientExtras: extras.map((e) => (e.store !== undefined && e.period !== undefined
        ? { label: `${e.store} ${e.period}`, store: e.store, period: e.period, amountExTax: Number(e.amountExTax) || 0, calc: e.calc }
        : { label: e.label, amountExTax: Number(e.amountExTax) || 0, calc: e.calc })),
      staff: staff.map((s) => ({
        dates: s.dates,
        dayPlaces: s.dayPlaces,
        serviceExTax: Number(s.serviceExTax) || 0,
        serviceCalc: s.serviceCalc,
        travelInclTax: Number(s.travelInclTax) || 0,
      })),
    };
  }

  function submit(approveAfter: boolean) {
    setMsg(null);
    if (approveAfter && !approver.trim()) return setMsg({ ok: false, text: "承認者名を入力してください。" });
    startTransition(async () => {
      const res = await saveInvoiceEdit(invoiceId, payload(), approveAfter, approver);
      if (res.ok) {
        setMsg({ ok: true, text: res.message });
        router.push(`/admin/invoices/${invoiceId}`);
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  // 稼働日を変えたときは、残る日の稼働場所を引き継ぐ(日付を直した場合は、その日の場所も一緒に移す)。
  function setStaffDates(i: number, dates: string[], renamed?: { from: string; to: string }) {
    setStaff(
      staff.map((s, idx) => {
        if (idx !== i) return s;
        const dayPlaces: Record<string, string> = {};
        for (const d of dates) dayPlaces[d] = s.dayPlaces[d] ?? (renamed && d === renamed.to ? (s.dayPlaces[renamed.from] ?? "") : "");
        return { ...s, dates, dayPlaces };
      })
    );
  }
  const setDayPlace = (i: number, d: string, place: string) =>
    setStaff(staff.map((s, idx) => (idx === i ? { ...s, dayPlaces: { ...s.dayPlaces, [d]: place } } : s)));
  const setAllPlaces = (i: number, place: string) =>
    setStaff(staff.map((s, idx) => (idx === i ? { ...s, dayPlaces: Object.fromEntries(s.dates.map((d) => [d, place])) } : s)));

  const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
  const field = "block text-xs font-bold text-slate-300";
  const hint = "mt-1 text-xs font-normal text-slate-500";
  const patchStaff = (i: number, patch: Partial<Initial["staff"][number]>) =>
    setStaff(staff.map((x, xi) => (xi === i ? { ...x, ...patch } : x)));

  return (
    <div className="mt-6 space-y-6 pb-8">
      {initial.warnings.length > 0 && (
        <section className="rounded-2xl border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-200">
          {initial.warnings.map((w, i) => (<p key={i}>⚠ {w}</p>))}
        </section>
      )}

      {/* 請求書の基本項目 */}
      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <h2 className="text-base font-black">① 請求書の項目</h2>
        <div className="mt-4 space-y-4">
          <label className={field}>
            宛名
            <input value={addressee} onChange={(e) => setAddressee(e.target.value)} className={`${input} mt-1`} />
            <span className={hint}>「御中」は自動で付きます</span>
          </label>
          <label className={field}>
            件名
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={`${input} mt-1`} />
          </label>
          <label className={field}>
            振込先情報・備考
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} className={`${input} mt-1`} />
          </label>
          <div className="rounded-xl bg-slate-950 p-3 text-xs text-slate-400">
            品目は「業務委託費一式」の1行のみ／税率10%／発行日は稼働月の月末日で固定です（変更できません）。
          </div>
          {!initial.hasStatement && (
            <label className={field}>
              業務委託費一式の金額（税抜）
              <NumInput value={amount} onChange={setAmount} className={`${input} mt-1 max-w-[240px]`} />
            </label>
          )}
        </div>
      </section>

      {/* 稼働明細書の内訳 */}
      {staff.length > 0 && (
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="text-base font-black">② 稼働明細書の内訳（スタッフごと）</h2>
          <p className="mt-1 text-xs text-slate-400">ここで直した金額は、請求書の「業務委託費一式」に自動で反映されます。稼働日を変えても金額は自動では変わらないので、必要なら業務委託費も直してください。</p>
          <div className="mt-4 space-y-5">
            {staff.map((s, i) => (
              <div key={i} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-base font-black">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.places || "―"} ／ {s.carriers || "―"}</p>
                </div>

                <div className="mt-4">
                  <p className={field}>稼働日（{s.dates.length}日）</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.dates.map((d, di) => (
                      <span key={di} className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1">
                        <input
                          type="date"
                          value={d}
                          min={`${yearMonth}-01`}
                          max={`${yearMonth}-31`}
                          onChange={(e) => setStaffDates(i, s.dates.map((x, xi) => (xi === di ? e.target.value : x)), { from: d, to: e.target.value })}
                          className="bg-transparent text-sm"
                        />
                        <button type="button" aria-label="この日を削除" onClick={() => setStaffDates(i, s.dates.filter((_, xi) => xi !== di))} className="px-1 text-xs text-red-300">✕</button>
                      </span>
                    ))}
                    <button type="button" onClick={() => setStaffDates(i, [...s.dates, `${yearMonth}-01`])} className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-bold">＋ 日を追加</button>
                  </div>
                </div>

                <div className="mt-4">
                  <p className={field}>稼働場所（日ごと）</p>
                  <p className={hint}>
                    直した日の場所は、保存すると<b>シフトと打刻履歴の店舗名にも反映</b>されます。場所を変えても、交通費は自動では変わりません（必要なら下で直してください）。
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      list={`places-${i}`}
                      placeholder="すべての日を同じ場所にする場合に入力"
                      id={`all-place-${i}`}
                      className={input}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(`all-place-${i}`) as HTMLInputElement | null;
                        if (el?.value.trim()) setAllPlaces(i, el.value.trim());
                      }}
                      className="shrink-0 rounded-lg border border-slate-600 px-3 py-1 text-xs font-bold"
                    >
                      全日に適用
                    </button>
                  </div>
                  <datalist id={`places-${i}`}>
                    {[...new Set(Object.values(s.dayPlaces).filter(Boolean))].map((p) => (<option key={p} value={p} />))}
                  </datalist>
                  <div className="mt-2 space-y-1">
                    {s.dates.map((d) => (
                      <label key={d} className="flex items-center gap-2 text-xs text-slate-300">
                        <span className="w-24 shrink-0">{d.slice(5).replace("-", "/")}</span>
                        <input
                          list={`places-${i}`}
                          value={s.dayPlaces[d] ?? ""}
                          onChange={(e) => setDayPlace(i, d, e.target.value)}
                          placeholder="稼働場所（空欄は「稼働店舗 要確認」と表示）"
                          className={input}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className={field}>
                    業務委託費（税抜・円）
                    <NumInput value={s.serviceExTax} onChange={(n) => patchStaff(i, { serviceExTax: n })} className={`${input} mt-1`} />
                  </label>
                  <label className={field}>
                    交通費相当額（税込・円）
                    <NumInput value={s.travelInclTax} onChange={(n) => patchStaff(i, { travelInclTax: n })} className={`${input} mt-1`} />
                    <span className={hint}>
                      0なら載せません。税別で計算します
                      {Number(s.travelInclTax) > 0 ? `（税込${Number(s.travelInclTax).toLocaleString("ja-JP")}円 → ${yen(travelEx(Number(s.travelInclTax)))}＋税）` : "（例: 税込1,100円 → 1,000円＋税）"}
                    </span>
                  </label>
                </div>
                <label className={`${field} mt-4`}>
                  業務委託費の計算方法（明細書に表示）
                  <input value={s.serviceCalc} onChange={(e) => patchStaff(i, { serviceCalc: e.target.value })} className={`${input} mt-1`} placeholder="例: 日額 ¥20,000 × 3日" />
                </label>
                {s.extrasExTax > 0 && <p className="mt-3 text-xs text-slate-500">その他の経費（変更不可）: {s.extrasLabel} 税抜{yen(s.extrasExTax)}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 取引先全体の項目 */}
      {initial.hasStatement && (
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="text-base font-black">③ 共通の項目（広告原価・商材仕入れ代原価など）</h2>
          <p className="mt-1 text-xs text-slate-400">スタッフ別ではない項目です。金額は税抜で入力してください（消費税は合計に10%で計算されます）。ある月だけ追加し、ない月は載せません。</p>
          <div className="mt-4 space-y-3">
            {extras.map((e, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 md:grid-cols-[1fr_160px_auto]">
                {e.store !== undefined && e.period !== undefined ? (
                  <div className="space-y-2">
                    <label className={field}>
                      イベント主催店舗
                      <input value={e.store} onChange={(ev) => setExtras(extras.map((x, xi) => (xi === i ? { ...x, store: ev.target.value } : x)))} className={`${input} mt-1`} />
                    </label>
                    <label className={field}>
                      イベント開催期間
                      <input value={e.period} onChange={(ev) => setExtras(extras.map((x, xi) => (xi === i ? { ...x, period: ev.target.value } : x)))} className={`${input} mt-1`} />
                    </label>
                  </div>
                ) : (
                  <label className={field}>
                    項目名
                    <input value={e.label} onChange={(ev) => setExtras(extras.map((x, xi) => (xi === i ? { ...x, label: ev.target.value } : x)))} className={`${input} mt-1`} />
                  </label>
                )}
                <label className={field}>
                  金額（税抜・円）
                  <NumInput value={e.amountExTax} onChange={(n) => setExtras(extras.map((x, xi) => (xi === i ? { ...x, amountExTax: n } : x)))} className={`${input} mt-1`} />
                </label>
                <button type="button" onClick={() => setExtras(extras.filter((_, xi) => xi !== i))} className="self-end rounded-lg border border-red-900 px-3 py-2 text-xs font-bold text-red-300">削除</button>
                <label className={`${field} md:col-span-3`}>
                  計算方法（明細書に表示。空なら「¥金額＋税で計算」）
                  <input value={e.calc} onChange={(ev) => setExtras(extras.map((x, xi) => (xi === i ? { ...x, calc: ev.target.value } : x)))} className={`${input} mt-1`} placeholder="例: イベントシステムの消化金額" />
                </label>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setExtras([...extras, { label: "広告原価", amountExTax: 0, calc: "" }])} className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-bold">＋ 広告原価</button>
              <button type="button" onClick={() => setExtras([...extras, { label: "商材仕入れ代原価", amountExTax: 0, calc: "" }])} className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-bold">＋ 商材仕入れ代原価</button>
              <button type="button" onClick={() => setExtras([...extras, { label: "", amountExTax: 0, calc: "" }])} className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-bold">＋ その他</button>
            </div>
          </div>
        </section>
      )}

      {/* 請求金額 */}
      <section className="rounded-2xl border border-blue-900 bg-blue-950/30 p-5">
        <h2 className="text-base font-black">請求金額（自動計算）</h2>
        <dl className="mt-3 space-y-1 text-sm text-slate-300">
          <div className="flex justify-between"><dt>業務委託費一式（税抜）</dt><dd>{yen(subtotal)}</dd></div>
          <div className="flex justify-between"><dt>消費税（10%）</dt><dd>{yen(tax)}</dd></div>
          <div className="flex justify-between border-t border-slate-700 pt-2 text-lg font-black text-white"><dt>合計（税込）</dt><dd>{yen(subtotal + tax)}</dd></div>
        </dl>
      </section>

      {/* 保存 */}
      <section className="rounded-2xl border border-red-900 bg-red-950/20 p-5">
        <p className="text-xs text-slate-400">
          {status === "APPROVED" ? "この請求は承認済みです。保存しても承認済みのままです。メールは送信されません。" : "保存しても下書きのままです。メールは送信されません。"}
        </p>
        <p className="mt-1 text-xs text-slate-500">送信先（送信するとき）: {recipients}</p>
        {status === "DRAFT" && (
          <label className={`${field} mt-3`}>
            承認者名（「保存して承認」を使うときだけ入力）
            <input value={approver} onChange={(e) => setApprover(e.target.value)} placeholder="承認者名" className={`${input} mt-1`} />
          </label>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={pending} onClick={() => submit(false)} className="rounded-xl bg-slate-100 px-6 py-3 font-black text-slate-900 disabled:opacity-50">
            {pending ? "処理中..." : "保存"}
          </button>
          {status === "DRAFT" && (
            <button type="button" disabled={pending} onClick={() => submit(true)} className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white disabled:opacity-50">
              保存して承認
            </button>
          )}
        </div>
        {msg && <p className={`mt-3 text-sm font-bold ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      </section>
    </div>
  );
}
