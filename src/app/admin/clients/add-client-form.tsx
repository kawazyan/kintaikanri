"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminCreateClient } from "./actions";

// 取引先(請求先のクライアントなど)を追加する。追加すると、請求管理の「請求下書きを作成」で選べるようになる。
export function AddClientForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit() {
    setMessage(null);
    if (!name.trim()) return setMessage({ ok: false, text: "会社名を入力してください。" });
    start(async () => {
      const res = await adminCreateClient({ name, contactName, phone, emails });
      if (res.ok) {
        setMessage({ ok: true, text: `取引先「${res.name}」を追加しました。請求管理の「請求下書きを作成」で選べます。` });
        setName("");
        setContactName("");
        setPhone("");
        setEmails("");
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  const field = "mt-1 w-full rounded-xl border p-3 text-sm";
  return (
    <section className="mt-6 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="text-lg font-black">取引先を追加</h2>
      <p className="mt-1 text-xs font-bold text-slate-500">請求書を送る会社を登録します。会社名だけでも追加できます（請求書の送信先は、請求書ごとにも入力できます）。</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-bold">会社名（必須）
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 株式会社○○" className={field} />
        </label>
        <label className="text-sm font-bold">担当者名（任意）
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={field} />
        </label>
        <label className="text-sm font-bold">請求書の送信先メール（任意・複数可）
          <textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={2} placeholder="例: a@example.com（複数は改行かカンマで区切る）" className={field} />
        </label>
        <label className="text-sm font-bold">電話番号（任意）
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
        </label>
      </div>
      <button type="button" onClick={submit} disabled={pending} className="mt-4 rounded-2xl bg-[#14283b] px-6 py-3 text-sm font-black text-white disabled:opacity-50">
        {pending ? "追加中..." : "取引先を追加"}
      </button>
      {message && <p className={`mt-3 text-sm font-bold ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>}
    </section>
  );
}
