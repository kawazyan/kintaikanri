"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addManualStaffNoShift } from "../actions";

// シフト・稼働依頼に紐付かないスタッフを、手入力で追加する(下書きのみ)。金額は空でもよい(あとで「修正」画面で入力)。契約には自動登録しない。
export function AddManualStaffForm({ invoiceId, yearMonth, staff }: { invoiceId: string; yearMonth: string; staff: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // REGISTERED=勤怠に登録済みのスタッフを選ぶ / EXTERNAL=勤怠に登録していない人(パートナー会社のスタッフなど)の名前を入力する
  const [mode, setMode] = useState<"REGISTERED" | "EXTERNAL">("REGISTERED");
  const [staffId, setStaffId] = useState("");
  const [externalName, setExternalName] = useState("");
  const [carrier, setCarrier] = useState("");
  const [storeName, setStoreName] = useState("");
  const [amount, setAmount] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [y, m] = yearMonth.split("-").map(Number);
  const monthDays = Array.from({ length: new Date(Date.UTC(y, m, 0)).getUTCDate() }, (_, k) => k + 1);
  const dateOf = (d: number) => `${yearMonth}-${String(d).padStart(2, "0")}`;
  const weekday = (d: number) => "日月火水木金土"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit() {
    const trimmed = amount.replace(/[,，\s]/g, "");
    const serviceExTax = trimmed === "" ? 0 : Number(trimmed);
    if (mode === "REGISTERED" && !staffId) return setMessage({ ok: false, text: "スタッフを選んでください。" });
    if (mode === "EXTERNAL" && !externalName.trim()) return setMessage({ ok: false, text: "スタッフ名を入力してください。" });
    if (!storeName.trim()) return setMessage({ ok: false, text: "店舗名を入力してください。" });
    if (!Number.isInteger(serviceExTax) || serviceExTax < 0) return setMessage({ ok: false, text: "金額（税抜）は数字で入力してください（未定なら空欄）。" });
    setMessage(null);
    start(async () => {
      const res = await addManualStaffNoShift(
        invoiceId,
        mode === "REGISTERED" ? { staffId, storeName, serviceExTax, dates: picked } : { externalName, carrier, storeName, serviceExTax, dates: picked }
      );
      if (res.ok) {
        setMessage({ ok: true, text: res.message });
        setStaffId("");
        setExternalName("");
        setCarrier("");
        setStoreName("");
        setAmount("");
        setPicked([]);
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
        稼働日は下の日付から選べます（あとから「修正」画面でも変更できます）。この追加では、取引先の契約には自動登録しません。
      </p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="radio" name="staffMode" checked={mode === "REGISTERED"} onChange={() => setMode("REGISTERED")} />勤怠に登録済みのスタッフ</label>
        <label className="flex items-center gap-2"><input type="radio" name="staffMode" checked={mode === "EXTERNAL"} onChange={() => setMode("EXTERNAL")} />勤怠に登録していない人（パートナー会社のスタッフなど）</label>
      </div>
      {mode === "EXTERNAL" && (
        <p className="mt-2 text-xs text-slate-400">名前を入力して追加します。勤怠のシフト・打刻はないので、稼働日と金額は自分で入力してください。請求書と請求内訳書は、ほかのスタッフと同じ形になります。</p>
      )}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {mode === "REGISTERED" ? (
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={field} aria-label="スタッフ">
            <option value="">スタッフを選択</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        ) : (
          <input value={externalName} onChange={(e) => setExternalName(e.target.value)} placeholder="スタッフ名（例: 山田　太郎）" className={field} aria-label="スタッフ名" />
        )}
        {mode === "EXTERNAL" && <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="キャリア（任意。例: au）" className={field} />}
        <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="店舗名（請求書に載せる表記）" className={field} />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="業務委託費（税抜）空欄＝未入力" className={field} />
      </div>
      <p className="mt-4 text-sm text-slate-300">稼働日（タップで選択／もう一度タップで解除）: {picked.length}日</p>
      <div className="mt-2 grid grid-cols-7 gap-1 sm:grid-cols-10">
        {monthDays.map((d) => {
          const on = picked.includes(dateOf(d));
          return (
            <button
              key={d}
              type="button"
              onClick={() => setPicked(on ? picked.filter((x) => x !== dateOf(d)) : [...picked, dateOf(d)].sort())}
              className={`rounded-lg px-1 py-2 text-xs font-black ${on ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              {d}
              <span className="block text-[10px] font-normal opacity-80">{weekday(d)}</span>
            </button>
          );
        })}
      </div>
      <button type="button" onClick={submit} disabled={pending} className="mt-3 rounded-xl bg-blue-600 px-5 py-2 text-sm font-black text-white disabled:opacity-50">
        {pending ? "追加中..." : "手入力で追加"}
      </button>
      {message && <p className={`mt-3 text-sm font-bold ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
    </section>
  );
}
