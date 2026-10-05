"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addStaffToDraft } from "../actions";

// 契約にいないスタッフを、請求書の画面で追加する(下書きのみ)。承認すると契約に自動登録される。
export function AddStaffForm({ invoiceId, staff }: { invoiceId: string; staff: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [staffId, setStaffId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [rate, setRate] = useState("");
  const [deduct, setDeduct] = useState<"YES" | "NO">("YES");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit() {
    const rateExTax = Number(rate.replace(/[,，\s]/g, ""));
    if (!staffId) return setMessage({ ok: false, text: "スタッフを選んでください。" });
    if (!storeName.trim()) return setMessage({ ok: false, text: "店舗名を入力してください。" });
    if (!Number.isInteger(rateExTax) || rateExTax <= 0) return setMessage({ ok: false, text: "月額（税抜）は数字で入力してください。" });
    const name = staff.find((s) => s.id === staffId)?.label ?? "";
    if (!window.confirm(`${name} を追加します。\n店舗: ${storeName.trim()}\n月額（税抜・控除前）: ¥${rateExTax.toLocaleString("ja-JP")}\n欠勤控除: ${deduct === "YES" ? "あり" : "なし"}\n\n承認すると、この内容で取引先の契約に自動登録されます。よろしいですか？`)) return;
    setMessage(null);
    start(async () => {
      const res = await addStaffToDraft(invoiceId, { staffId, storeName, rateExTax, absenceDeduction: deduct });
      if (res.ok) {
        setMessage({ ok: true, text: res.message });
        setStaffId("");
        setStoreName("");
        setRate("");
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  const field = "rounded-xl bg-slate-800 px-3 py-2 text-sm";
  return (
    <section className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <h2 className="font-black">スタッフを追加（契約に未登録のスタッフ）</h2>
      <p className="mt-1 text-xs text-slate-400">
        請求書に書いた内容が正です。承認すると、この店舗名・月額・欠勤控除で取引先の契約に自動登録し、当月のシフトの店舗名も揃えます。
        掛け持ちのスタッフも追加できます（他の取引先の契約と同じ店舗で重なる場合だけ追加できません）。交通費は個別には追加しません（取引先に共通の取り決めがあれば、その分のみ計算されます）。
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={field} aria-label="スタッフ">
          <option value="">スタッフを選択</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="店舗名（請求書に載せる表記）" className={field} />
        <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="numeric" placeholder="月額（税抜・欠勤控除する前）例: 360000" className={field} />
        <select value={deduct} onChange={(e) => setDeduct(e.target.value as "YES" | "NO")} className={field} aria-label="欠勤控除">
          <option value="YES">欠勤控除あり（月額 ÷ 登録シフト日数 × 稼働日数）</option>
          <option value="NO">欠勤控除なし（月額固定）</option>
        </select>
      </div>
      <button type="button" onClick={submit} disabled={pending} className="mt-3 rounded-xl bg-blue-600 px-5 py-2 text-sm font-black text-white disabled:opacity-50">
        {pending ? "追加中..." : "スタッフを追加"}
      </button>
      {message && <p className={`mt-3 text-sm font-bold ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
    </section>
  );
}
