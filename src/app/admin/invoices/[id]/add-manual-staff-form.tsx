"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addManualStaffNoShift } from "../actions";

// シフト・稼働依頼に紐付かないスタッフを、手入力で追加する(下書きのみ)。金額は空でもよい(あとで「修正」画面で入力)。契約には自動登録しない。
export function AddManualStaffForm({ invoiceId, staff }: { invoiceId: string; staff: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [staffId, setStaffId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit() {
    const trimmed = amount.replace(/[,，\s]/g, "");
    const serviceExTax = trimmed === "" ? 0 : Number(trimmed);
    if (!staffId) return setMessage({ ok: false, text: "スタッフを選んでください。" });
    if (!storeName.trim()) return setMessage({ ok: false, text: "店舗名を入力してください。" });
    if (!Number.isInteger(serviceExTax) || serviceExTax < 0) return setMessage({ ok: false, text: "金額（税抜）は数字で入力してください（未定なら空欄）。" });
    setMessage(null);
    start(async () => {
      const res = await addManualStaffNoShift(invoiceId, { staffId, storeName, serviceExTax });
      if (res.ok) {
        setMessage({ ok: true, text: res.message });
        setStaffId("");
        setStoreName("");
        setAmount("");
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  const field = "rounded-xl bg-slate-800 px-3 py-2 text-sm";
  return (
    <section className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <h2 className="font-black">スタッフを追加（シフトなし・手入力）</h2>
      <p className="mt-1 text-xs text-slate-400">
        シフトや稼働依頼がなくても追加できます。前月の単価が月末後にしか分からないときは、金額を空欄のまま追加し、分かってから「修正」画面で入力してください（金額が0円のままでは承認・送付できません）。
        この追加では、取引先の契約には自動登録しません。
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={field} aria-label="スタッフ">
          <option value="">スタッフを選択</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="店舗名（請求書に載せる表記）" className={field} />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="業務委託費（税抜）空欄＝未入力" className={field} />
      </div>
      <button type="button" onClick={submit} disabled={pending} className="mt-3 rounded-xl bg-blue-600 px-5 py-2 text-sm font-black text-white disabled:opacity-50">
        {pending ? "追加中..." : "手入力で追加"}
      </button>
      {message && <p className={`mt-3 text-sm font-bold ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
    </section>
  );
}
