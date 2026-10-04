"use client";

import { useState, useTransition } from "react";
import type { ShiftBillingRule } from "@/lib/billing-terms";
import { adminDeleteContract, adminSaveContract, type ContractInput } from "./actions";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const empty: ContractInput = {
  staffName: "", storeMatch: [], fromMonth: "", toMonth: "", contract: "DAILY", rateExTax: 0,
  absenceDeduction: "NO", plannedDays: 0, flatTravelExTax: 0, note: "",
};
const field = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold";

export function ContractsEditor({ clientId, rules, staffNames }: { clientId: string; rules: ShiftBillingRule[]; staffNames: string[] }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<ContractInput>(empty);
  const [stores, setStores] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const open = (i: number | "new") => {
    setError("");
    if (i === "new") { setForm(empty); setStores(""); }
    else {
      const r = rules[i];
      setForm({
        staffName: r.staffName, storeMatch: r.storeMatch ?? [], fromMonth: r.fromMonth ?? "", toMonth: r.toMonth ?? "",
        contract: r.contract, rateExTax: r.rateExTax, absenceDeduction: r.absenceDeduction ?? "NO",
        plannedDays: r.plannedDays ?? 0, flatTravelExTax: r.flatTravelExTax ?? 0, note: r.note ?? "",
      });
      setStores((r.storeMatch ?? []).join("、"));
    }
    setEditing(i);
  };

  const submit = () => {
    setError("");
    const storeMatch = stores.split(/[、,，\n]/).map((s) => s.trim()).filter(Boolean);
    start(async () => {
      try {
        await adminSaveContract(clientId, editing === "new" ? null : (editing as number), { ...form, storeMatch });
        setEditing(null);
      } catch (e) { setError(e instanceof Error ? e.message : "保存に失敗しました。"); }
    });
  };
  const remove = (i: number) => {
    if (!window.confirm("この契約を削除します。よろしいですか?")) return;
    start(async () => { try { await adminDeleteContract(clientId, i); } catch (e) { setError(e instanceof Error ? e.message : "削除に失敗しました。"); } });
  };
  const set = <K extends keyof ContractInput>(k: K, v: ContractInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  return <div>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500"><tr>
          <th className="px-4 py-3">スタッフ</th><th className="px-4 py-3">店舗(名前に含む)</th><th className="px-4 py-3">期間</th><th className="px-4 py-3">契約・単価(税抜)</th><th className="px-4 py-3" />
        </tr></thead>
        <tbody>
          {rules.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center font-bold text-slate-400">契約がまだありません。「契約を追加」から登録してください。</td></tr>}
          {rules.map((r, i) => <tr key={i} className="border-t border-slate-100 align-top">
            <td className="px-4 py-3 font-black">{r.staffName}</td>
            <td className="px-4 py-3 font-bold">{r.storeMatch?.length ? r.storeMatch.join("、") : <span className="text-slate-400">すべての店舗</span>}{r.dates?.length ? <span className="block text-xs text-slate-400">日付指定: {r.dates.length}日</span> : null}</td>
            <td className="px-4 py-3 font-bold">{r.fromMonth || "最初から"} ～ {r.toMonth || "ずっと"}</td>
            <td className="px-4 py-3 font-bold">{r.contract === "DAILY" ? `日額 ${yen(r.rateExTax)}` : `月額 ${yen(r.rateExTax)}`}
              {r.contract === "MONTHLY" && <span className="block text-xs text-slate-500">{r.absenceDeduction === "YES" ? `欠勤で減算(予定${r.plannedDays}日)` : "月額固定"}</span>}
              {r.flatTravelExTax ? <span className="block text-xs text-slate-500">交通費 月{yen(r.flatTravelExTax)}</span> : null}
              {r.note ? <span className="block text-xs text-slate-500">{r.note}</span> : null}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right">
              <button disabled={pending} onClick={() => open(i)} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black">編集</button>{" "}
              <button disabled={pending} onClick={() => remove(i)} className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700">削除</button>
            </td></tr>)}
        </tbody>
      </table>
    </div>
    {editing === null && <button onClick={() => open("new")} className="mt-4 rounded-2xl bg-[#14283b] px-5 py-3 text-sm font-black text-white">契約を追加</button>}
    {error && editing === null && <p className="mt-3 text-sm font-black text-rose-700">{error}</p>}

    {editing !== null && <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-black">{editing === "new" ? "契約を追加" : "契約を編集"}</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-black text-slate-500">スタッフ
          <select className={field} value={form.staffName} onChange={(e) => set("staffName", e.target.value)}>
            <option value="">選んでください</option>
            {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
            {form.staffName && !staffNames.includes(form.staffName) && <option value={form.staffName}>{form.staffName}</option>}
          </select></label>
        <label className="text-xs font-black text-slate-500">店舗名に含まれる言葉(複数は「、」区切り。空ならすべての店舗)
          <input className={field} value={stores} onChange={(e) => setStores(e.target.value)} placeholder="例: 石巻、ケーズ" /></label>
        <label className="text-xs font-black text-slate-500">開始月(空=最初から)
          <input type="month" className={field} value={form.fromMonth} onChange={(e) => set("fromMonth", e.target.value)} /></label>
        <label className="text-xs font-black text-slate-500">終了月(空=ずっと)
          <input type="month" className={field} value={form.toMonth} onChange={(e) => set("toMonth", e.target.value)} /></label>
        <label className="text-xs font-black text-slate-500">契約の形
          <select className={field} value={form.contract} onChange={(e) => set("contract", e.target.value as "DAILY" | "MONTHLY")}>
            <option value="DAILY">日額(日額 × 稼働日数)</option><option value="MONTHLY">月額</option></select></label>
        <label className="text-xs font-black text-slate-500">{form.contract === "DAILY" ? "日額(税抜・円)" : "月額(税抜・円)"}
          <input type="number" min={0} className={field} value={form.rateExTax || ""} onChange={(e) => set("rateExTax", Number(e.target.value))} /></label>
        {form.contract === "MONTHLY" && <>
          <label className="text-xs font-black text-slate-500">欠勤したとき
            <select className={field} value={form.absenceDeduction} onChange={(e) => set("absenceDeduction", e.target.value as "YES" | "NO")}>
              <option value="NO">減算しない(月額固定)</option><option value="YES">減算する(月額 ÷ 予定日数 × 稼働日数)</option></select></label>
          {form.absenceDeduction === "YES" && <label className="text-xs font-black text-slate-500">予定日数(月)
            <input type="number" min={1} className={field} value={form.plannedDays || ""} onChange={(e) => set("plannedDays", Number(e.target.value))} /></label>}
        </>}
        <label className="text-xs font-black text-slate-500">交通費(月一律・税抜・円。なければ空)
          <input type="number" min={0} className={field} value={form.flatTravelExTax || ""} onChange={(e) => set("flatTravelExTax", Number(e.target.value))} /></label>
        <label className="text-xs font-black text-slate-500">メモ(請求の計算欄に添える一言。任意)
          <input className={field} value={form.note} onChange={(e) => set("note", e.target.value)} /></label>
      </div>
      {error && <p className="mt-3 text-sm font-black text-rose-700">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button disabled={pending} onClick={submit} className="rounded-2xl bg-[#14283b] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{pending ? "保存中…" : "保存する"}</button>
        <button disabled={pending} onClick={() => setEditing(null)} className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black">キャンセル</button>
      </div>
    </div>}
  </div>;
}
