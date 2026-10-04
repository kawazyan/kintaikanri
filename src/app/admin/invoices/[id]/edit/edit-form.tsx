"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveInvoiceEdit, type InvoiceEditPayload } from "../../actions";

type Initial = {
  addressee: string;
  subject: string;
  note: string;
  lines: { label: string; description: string; quantity: number; unitPriceExTax: number }[];
  staff: { name: string; places: string; carriers: string; dates: string[]; travelInclTax: number }[];
};

const input = "w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100";

export function EditInvoiceForm({
  invoiceId,
  recipients,
  initial,
  yearMonth,
}: {
  invoiceId: string;
  recipients: string;
  initial: Initial;
  yearMonth: string;
}) {
  const router = useRouter();
  const [addressee, setAddressee] = useState(initial.addressee);
  const [subject, setSubject] = useState(initial.subject);
  const [note, setNote] = useState(initial.note);
  const [lines, setLines] = useState(initial.lines);
  const [staff, setStaff] = useState(initial.staff);
  const [approver, setApprover] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPriceExTax) || 0), 0);
  const tax = Math.floor((subtotal * 10) / 100);

  function payload(): InvoiceEditPayload {
    return {
      addressee,
      subject,
      note,
      lines: lines.map((l) => ({
        label: l.label,
        description: l.description,
        quantity: Number(l.quantity),
        unitPriceExTax: Number(l.unitPriceExTax),
      })),
      staff: staff.map((s) => ({ dates: s.dates, travelInclTax: Number(s.travelInclTax) || 0 })),
    };
  }

  function submit(sendAfter: boolean) {
    setMsg(null);
    if (sendAfter) {
      if (!approver.trim()) return setMsg({ ok: false, text: "承認者名を入力してください。" });
      if (!window.confirm(`修正内容を保存し、請求書と稼働明細書（税込 ¥${(subtotal + tax).toLocaleString("ja-JP")}）を\n${recipients}\nへメール送信して確定します。よろしいですか？`)) return;
    }
    startTransition(async () => {
      const res = await saveInvoiceEdit(invoiceId, payload(), sendAfter, approver);
      if (res.ok) {
        setMsg({ ok: true, text: res.message });
        router.push(`/admin/invoices/${invoiceId}`);
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  function setLine(i: number, patch: Partial<Initial["lines"][number]>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function setStaffDates(i: number, dates: string[]) {
    setStaff(staff.map((s, idx) => (idx === i ? { ...s, dates } : s)));
  }

  return (
    <div className="mt-6 space-y-8">
      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <h2 className="text-lg font-black">請求書</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-slate-400">
            宛名（「御中」は自動で付きます）
            <input value={addressee} onChange={(e) => setAddressee(e.target.value)} className={input} />
          </label>
          <label className="text-xs text-slate-400">
            件名
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={input} />
          </label>
        </div>

        <h3 className="mt-5 text-sm font-black">明細行（税率は10%固定）</h3>
        <div className="mt-2 space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="rounded-xl bg-slate-950 p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_90px_140px_auto]">
                <input value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} placeholder="品名" className={input} />
                <input type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} placeholder="数量" className={input} />
                <input type="number" value={l.unitPriceExTax} onChange={(e) => setLine(i, { unitPriceExTax: Number(e.target.value) })} placeholder="単価（税抜）" className={input} />
                <button type="button" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="rounded-lg border border-red-800 px-3 py-2 text-xs font-bold text-red-300">削除</button>
              </div>
              <input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="補足（任意）" className={`${input} mt-2`} />
              <p className="mt-1 text-right text-xs text-slate-500">金額（税抜）¥{((Number(l.quantity) || 0) * (Number(l.unitPriceExTax) || 0)).toLocaleString("ja-JP")}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setLines([...lines, { label: "", description: "", quantity: 1, unitPriceExTax: 0 }])} className="mt-3 rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold">＋ 行を追加</button>
        <p className="mt-3 text-right text-sm text-slate-300">
          小計 ¥{subtotal.toLocaleString("ja-JP")}　消費税 ¥{tax.toLocaleString("ja-JP")}　<b>合計 ¥{(subtotal + tax).toLocaleString("ja-JP")}</b>
        </p>

        <label className="mt-4 block text-xs text-slate-400">
          振込先情報・備考
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} className={input} />
        </label>
      </section>

      {staff.length > 0 && (
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="text-lg font-black">稼働明細書</h2>
          <p className="mt-1 text-xs text-amber-300">
            ここを直しても、請求書の金額は自動では変わりません。金額に影響する場合は、上の請求書の明細行も直してください。
          </p>
          <div className="mt-3 space-y-4">
            {staff.map((s, i) => (
              <div key={i} className="rounded-xl bg-slate-950 p-4">
                <p className="font-black">{s.name}</p>
                <p className="text-xs text-slate-500">稼働場所: {s.places || "―"} ／ キャリア: {s.carriers || "―"}</p>
                <p className="mt-3 text-xs text-slate-400">稼働日（{s.dates.length}日）</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {s.dates.map((d, di) => (
                    <span key={di} className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1">
                      <input
                        type="date"
                        value={d}
                        min={`${yearMonth}-01`}
                        max={`${yearMonth}-31`}
                        onChange={(e) => setStaffDates(i, s.dates.map((x, xi) => (xi === di ? e.target.value : x)))}
                        className="bg-transparent text-sm"
                      />
                      <button type="button" onClick={() => setStaffDates(i, s.dates.filter((_, xi) => xi !== di))} className="text-xs text-red-300">✕</button>
                    </span>
                  ))}
                  <button type="button" onClick={() => setStaffDates(i, [...s.dates, `${yearMonth}-01`])} className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-bold">＋ 日を追加</button>
                </div>
                <label className="mt-3 block text-xs text-slate-400">
                  交通費（税込）。0なら交通費の行を出しません。税抜と消費税は自動で計算します（例: 税込1,100円 → 1,000円＋税）
                  <input
                    type="number"
                    min={0}
                    value={s.travelInclTax}
                    onChange={(e) => setStaff(staff.map((x, xi) => (xi === i ? { ...x, travelInclTax: Number(e.target.value) } : x)))}
                    className={`${input} mt-1 max-w-[200px]`}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-red-900 bg-red-950/20 p-5">
        <p className="text-xs text-slate-500">送信先: {recipients}</p>
        <input value={approver} onChange={(e) => setApprover(e.target.value)} placeholder="承認者名" className={`${input} mt-2`} />
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" disabled={pending} onClick={() => submit(true)} className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white disabled:opacity-50">
            {pending ? "処理中..." : "修正を保存してPDFをメール送信"}
          </button>
        </div>
        {msg && <p className={`mt-3 text-sm font-bold ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      </section>
    </div>
  );
}
