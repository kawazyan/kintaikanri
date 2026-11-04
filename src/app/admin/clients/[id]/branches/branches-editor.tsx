"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveClientBranches } from "../../actions";

type Row = { key: number; label: string; emails: string };
let seq = 0;
const withKey = (xs: { label: string; emails: string }[]): Row[] => xs.map((x) => ({ ...x, key: ++seq }));

// 請求先(店舗)の一覧を編集して保存する。送信先メールは、1行に1件か、カンマ区切りで入力する。
export function BranchesEditor({ clientId, initial }: { clientId: string; initial: { label: string; emails: string }[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => withKey(initial.length ? initial : [{ label: "", emails: "" }]));
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const patch = (key: number, p: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const field = "mt-1 w-full rounded-xl border p-3 text-sm";

  function save() {
    setMessage(null);
    start(async () => {
      const res = await saveClientBranches(clientId, rows.map(({ label, emails }) => ({ label, emails })));
      if (res.ok) {
        setMessage({ ok: true, text: `保存しました（${res.count}件）。請求下書きの作成で、店舗を選べます。` });
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      {rows.map((r, i) => (
        <div key={r.key} className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-500">請求先 {i + 1}</p>
            <button type="button" onClick={() => setRows(rows.filter((x) => x.key !== r.key))} className="rounded-xl border border-red-300 px-3 py-1.5 text-xs font-black text-red-700">削除</button>
          </div>
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold">店舗名（宛名・請求書に載る名前）
              <input value={r.label} onChange={(e) => patch(r.key, { label: e.target.value })} placeholder="例: SB秋田山王店" className={field} />
            </label>
            <label className="text-sm font-bold">送信先メール（1行に1件）
              <textarea value={r.emails} onChange={(e) => patch(r.key, { emails: e.target.value })} rows={3} placeholder={"例:\na@example.com\nb@example.com"} className={field} />
            </label>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setRows([...rows, ...withKey([{ label: "", emails: "" }])])} className="rounded-2xl border border-[#14283b] px-5 py-3 text-sm font-black text-[#14283b]">＋ 請求先を追加</button>
        <button type="button" onClick={save} disabled={pending} className="rounded-2xl bg-[#14283b] px-6 py-3 text-sm font-black text-white disabled:opacity-50">{pending ? "保存中..." : "保存"}</button>
      </div>
      <p className="text-xs font-bold text-slate-500">店舗名を変えると、前の月の請求の引き継ぎは、その店舗では効かなくなります。すでに作った請求書の宛名・送信先は変わりません。管理者のCCは、今までどおり自動で付きます。</p>
      {message && <p className={`text-sm font-bold ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>}
    </div>
  );
}
