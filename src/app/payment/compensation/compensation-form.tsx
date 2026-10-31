"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { addCompensationRequest, type CompensationFormState } from "./actions";

type Row = { label: string; amount: string; memo: string };
const emptyRow = (): Row => ({ label: "", amount: "", memo: "" });

// 全角数字・カンマ・円記号を取り除いて数値にする(合計の表示用。保存時の検証はサーバー側で行う)。
const toNumber = (raw: string) => {
  const half = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，¥￥円\s]/g, "");
  return /^\d+$/.test(half) ? Number(half) : 0;
};

export function CompensationForm({ monthOptions, defaultMonth }: { monthOptions: { value: string; label: string }[]; defaultMonth?: string }) {
  const [state, action] = useActionState<CompensationFormState, FormData>(addCompensationRequest, {});
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  // 申請できたら、入力欄を空に戻す。
  useEffect(() => {
    if (state.savedAt) setRows([emptyRow()]);
  }, [state.savedAt]);

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const total = rows.reduce((sum, r) => sum + toNumber(r.amount), 0);

  return (
    <form action={action} className="mt-5 space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <label className="block text-xs font-black">
        対象月
        <select name="yearMonth" defaultValue={defaultMonth} className="mt-1 w-full min-w-0 rounded-xl border p-3 text-sm">
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-black">
        区分
        <select name="category" className="mt-1 w-full min-w-0 rounded-xl border p-3 text-sm">
          <option value="REFERRAL">リファラル報酬</option>
          <option value="INCENTIVE">インセンティブ</option>
          <option value="OTHER">その他</option>
        </select>
      </label>

      <div>
        <p className="text-xs font-black">内訳(1行に1人・1件ずつ入力)</p>
        <div className="mt-1 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="rounded-2xl border border-slate-300 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-600">{i + 1}件目</span>
                {rows.length > 1 && (
                  <button type="button" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="text-xs font-bold text-red-600">
                    この行を消す
                  </button>
                )}
              </div>
              <input
                name="itemLabel"
                value={r.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="対象(例: 柴田さん)"
                maxLength={100}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
              />
              <input
                name="itemAmount"
                value={r.amount}
                onChange={(e) => update(i, { amount: e.target.value })}
                inputMode="numeric"
                placeholder="金額(税込・円。例: 62000)"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
              />
              <textarea
                name="itemMemo"
                value={r.memo}
                onChange={(e) => update(i, { memo: e.target.value })}
                rows={2}
                maxLength={300}
                placeholder="メモ(例: 単価38万 / 給料28万 / 会社10% 3.8万 / 渡辺分6.2万)"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
              />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRows((rs) => [...rs, emptyRow()])} className="mt-2 w-full rounded-xl border-2 border-dashed border-slate-400 py-2 text-sm font-black text-slate-700">
          ＋ 件数を増やす
        </button>
        <p className="mt-2 text-right text-sm font-black">
          合計(申請金額) <span className="text-lg">¥{total.toLocaleString("ja-JP")}</span>
        </p>
      </div>

      <label className="block text-xs font-black">
        全体のメモ(任意)
        <textarea name="description" rows={2} className="mt-1 w-full rounded-xl border p-3 text-sm" placeholder="全体への補足があれば" />
      </label>

      {state.error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{state.error}</p>}
      {state.savedAt && !state.error && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">申請しました。</p>}

      <SubmitButton className="w-full rounded-2xl bg-[#b91c1c] py-3 font-black text-white shadow-[0_4px_0_#7f1d1d]">別途報酬を申請する</SubmitButton>
    </form>
  );
}
