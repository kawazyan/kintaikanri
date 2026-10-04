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
  staff: {
    name: string;
    places: string;
    carriers: string;
    dates: string[];
    serviceExTax: number;
    serviceCalc: string;
    travelInclTax: number;
    extrasExTax: number;
    extrasLabel: string;
  }[];
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
  const [amount, setAmount] = useState(initial.amountExTax);
  const [staff, setStaff] = useState(initial.staff);
  const [approver, setApprover] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // 請求書は「業務委託費一式」1行。金額は稼働明細書の合計(業務委託費＋交通費相当額＋その他)。
  const travelEx = (incl: number) => (incl > 0 ? Math.floor((incl * 100) / 110) : 0);
  const subtotal = initial.hasStatement
    ? staff.reduce((sum, st) => sum + (Number(st.serviceExTax) || 0) + travelEx(Number(st.travelInclTax) || 0) + st.extrasExTax, 0)
    : Number(amount) || 0;
  const tax = Math.floor((subtotal * 10) / 100);

  function payload(): InvoiceEditPayload {
    return {
      addressee,
      subject,
      note,
      amountExTax: initial.hasStatement ? undefined : Number(amount),
      staff: staff.map((s) => ({
        dates: s.dates,
        serviceExTax: Number(s.serviceExTax) || 0,
        serviceCalc: s.serviceCalc,
        travelInclTax: Number(s.travelInclTax) || 0,
      })),
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

        <div className="mt-5 rounded-xl bg-slate-950 p-4">
          <p className="text-sm font-black">品目：業務委託費一式（税率10%）</p>
          <p className="mt-1 text-xs text-slate-500">請求書の品目はこの1行のみです。交通費相当額などは業務委託費に含まれ、内訳は稼働明細書に載ります。</p>
          {initial.hasStatement ? (
            <p className="mt-2 text-xs text-slate-400">金額は下の「稼働明細書」の合計から自動で計算されます。</p>
          ) : (
            <label className="mt-2 block text-xs text-slate-400">
              業務委託費一式の金額（税抜）
              <input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={`${input} mt-1 max-w-[220px]`} />
            </label>
          )}
          <p className="mt-3 text-right text-sm text-slate-300">
            小計 ¥{subtotal.toLocaleString("ja-JP")}　消費税 ¥{tax.toLocaleString("ja-JP")}　<b>合計 ¥{(subtotal + tax).toLocaleString("ja-JP")}</b>
          </p>
        </div>

        <label className="mt-4 block text-xs text-slate-400">
          振込先情報・備考
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} className={input} />
        </label>
      </section>

      {staff.length > 0 && (
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="text-lg font-black">稼働明細書</h2>
          <p className="mt-1 text-xs text-amber-300">
            ここで直した金額（業務委託費・交通費）は、請求書の「業務委託費一式」の金額に自動で反映されます。稼働日を変えても金額は自動では変わらないので、必要なら業務委託費も直してください。
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
                <div className="mt-3 grid gap-2 md:grid-cols-[180px_1fr]">
                  <label className="block text-xs text-slate-400">
                    業務委託費（税抜）
                    <input
                      type="number"
                      min={0}
                      value={s.serviceExTax}
                      onChange={(e) => setStaff(staff.map((x, xi) => (xi === i ? { ...x, serviceExTax: Number(e.target.value) } : x)))}
                      className={`${input} mt-1`}
                    />
                  </label>
                  <label className="block text-xs text-slate-400">
                    計算方法（明細書に表示）
                    <input
                      value={s.serviceCalc}
                      onChange={(e) => setStaff(staff.map((x, xi) => (xi === i ? { ...x, serviceCalc: e.target.value } : x)))}
                      className={`${input} mt-1`}
                    />
                  </label>
                </div>
                {s.extrasExTax > 0 && <p className="mt-2 text-xs text-slate-500">その他（変更不可）: {s.extrasLabel} 税抜¥{s.extrasExTax.toLocaleString("ja-JP")}</p>}
                <label className="mt-3 block text-xs text-slate-400">
                  交通費相当額（税込）。0なら載せません。税別で計算します（例: 税込1,100円 → 1,000円＋税）
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
