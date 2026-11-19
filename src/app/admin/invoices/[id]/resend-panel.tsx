"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resendInvoice } from "../actions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 送付済みの請求を、同じ内容でもう一度メール送信する。宛先は選び直せて、新しい宛先を足せる。
export function ResendPanel({
  invoiceId,
  registered,
  saveTarget,
  total,
  extra,
}: {
  invoiceId: string;
  registered: string[]; // いま登録されている宛先(取引先 or この請求)
  saveTarget: "CLIENT" | "INVOICE"; // 追加した宛先の保存先(請求ごとに宛先がある請求は INVOICE)
  total: number;
  extra: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(registered.map((x) => [x, true])));
  const [added, setAdded] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [save, setSave] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const all = [...registered, ...added];
  const selected = all.filter((x) => checked[x]);
  const newOnes = selected.filter((x) => !registered.some((r) => r.toLowerCase() === x.toLowerCase()));

  function addEmail() {
    const v = input.trim();
    if (!v) return;
    if (!EMAIL_RE.test(v)) return setMessage({ ok: false, text: "メールアドレスの形式が正しくありません。" });
    if (all.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setInput("");
      return setMessage({ ok: false, text: "すでに宛先にあります。" });
    }
    setAdded((a) => [...a, v]);
    setChecked((c) => ({ ...c, [v]: true }));
    setInput("");
    setMessage(null);
  }

  function resend() {
    if (!selected.length) return setMessage({ ok: false, text: "送信先を1件以上選んでください。" });
    const saveText = newOnes.length && save ? `\n\n追加した宛先（${newOnes.join(", ")}）は、${saveTarget === "CLIENT" ? "取引先" : "この請求"}の宛先にも保存します。` : "";
    if (!window.confirm(`${extra ? "請求書" : "請求書と請求内訳書"}（税込 ¥${total.toLocaleString("ja-JP")}）を\n${selected.join("\n")}\nへ再送します。よろしいですか？${saveText}`)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await resendInvoice(invoiceId, selected, save ? saveTarget : null);
      if (res.ok) {
        setMessage({ ok: true, text: res.message });
        setAdded([]);
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="mt-5 rounded-2xl border-2 border-blue-500 bg-slate-900 p-5">
      <h2 className="font-black">メールを再送する</h2>
      <p className="mt-1 text-xs text-slate-400">送付済みの請求を同じ内容でもう一度送ります。金額・請求番号・送付済みの記録は変わりません。チェックした宛先に送ります。</p>
      <ul className="mt-3 divide-y divide-slate-800 text-sm">
        {all.map((x) => (
          <li key={x}>
            <label className="flex cursor-pointer items-center gap-3 py-2 break-all">
              <input type="checkbox" checked={!!checked[x]} onChange={(e) => setChecked((c) => ({ ...c, [x]: e.target.checked }))} className="h-4 w-4" />
              <span>{x}</span>
              {!registered.includes(x) && <span className="rounded-full bg-amber-500 px-2 text-[10px] font-black text-slate-900">追加</span>}
            </label>
          </li>
        ))}
        {all.length === 0 && <li className="py-2 text-slate-400">登録された宛先がありません。下から追加してください。</li>}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          type="email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addEmail();
            }
          }}
          placeholder="アドレスを追加"
          className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm placeholder:!text-slate-500"
        />
        <button type="button" onClick={addEmail} className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-black">
          ＋追加
        </button>
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="h-4 w-4" />
        追加した宛先を{saveTarget === "CLIENT" ? "取引先" : "この請求"}の宛先にも保存する
      </label>
      {saveTarget === "INVOICE" && <p className="mt-1 text-xs text-slate-400">この請求は請求ごとに宛先を決めているため、取引先全体には保存せず、この請求だけに保存します。</p>}
      <button type="button" onClick={resend} disabled={pending} className="mt-4 w-full rounded-xl bg-blue-600 px-6 py-3 font-black text-white disabled:opacity-50">
        {pending ? "再送中..." : `再送する（${extra ? "請求書" : "請求書＋請求内訳書"}）`}
      </button>
      {message && <p className={`mt-3 text-sm font-bold ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
    </div>
  );
}
