"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveEstimate } from "./actions";
import { computeEstimateTotals, DEFAULT_ESTIMATE_SUBJECT, resolveEstimateRecipients, type EstimateTaxMode } from "@/lib/estimate";
import { splitEmails } from "@/lib/invoice-defaults";

// emails: 取引先に登録された請求用の宛先。cc: 管理者CCの表示用(例「（CC: a@b.c）」)。
export type EstimateClientOption = { id: string; name: string; emails: string[]; cc: string };

export type EstimateFormInitial = {
  clientId: string;
  issuedDate: string;
  addressee: string;
  storeName: string;
  recipientEmails: string;
  subject: string;
  note: string;
  taxMode: EstimateTaxMode;
  lines: { label: string; description: string; quantity: number; unitPrice: number }[];
};

type Line = EstimateFormInitial["lines"][number] & { key: number };
let lineKeySeq = 0;
const withKey = (xs: EstimateFormInitial["lines"]): Line[] => xs.map((x) => ({ ...x, key: ++lineKeySeq }));

const input = "w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100";

// 数字の入力欄。消して打ち直すときに先頭へ「0」が自動で付かない(空欄にできる)。空欄のまま確定したときだけ 0 に戻す。
function NumInput({ value, onChange, className }: { value: number; onChange: (n: number) => void; className?: string }) {
  const [text, setText] = useState(String(value));
  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
        setText(digits);
        onChange(digits === "" ? 0 : Number(digits));
      }}
      onBlur={() => text === "" && setText("0")}
      className={className}
    />
  );
}

export function EstimateForm({
  clients,
  initial,
  existingId,
  existingNumber,
}: {
  clients: EstimateClientOption[];
  initial: EstimateFormInitial;
  existingId?: string;
  existingNumber?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(initial.clientId);
  const [issuedDate, setIssuedDate] = useState(initial.issuedDate);
  const [addressee, setAddressee] = useState(initial.addressee);
  const [storeName, setStoreName] = useState(initial.storeName);
  const [recipientEmails, setRecipientEmails] = useState(initial.recipientEmails);
  const [subject, setSubject] = useState(initial.subject || DEFAULT_ESTIMATE_SUBJECT);
  const [note, setNote] = useState(initial.note);
  const [taxMode, setTaxMode] = useState<EstimateTaxMode>(initial.taxMode);
  const [lines, setLines] = useState<Line[]>(() => withKey(initial.lines.length ? initial.lines : [{ label: "", description: "", quantity: 1, unitPrice: 0 }]));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const client = clients.find((c) => c.id === clientId);
  // 送付先: 手入力した送信先メールアドレスがあればそれ、なければ取引先の登録(どちらもなければ未設定)。
  const toList = resolveEstimateRecipients(recipientEmails, client?.emails ?? []);
  const toText = toList.length ? `${toList.join(", ")}${client?.cc && !splitEmails(recipientEmails).length ? client.cc : ""}` : "";
  const totals = computeEstimateTotals(taxMode, lines.filter((l) => l.label.trim() || l.unitPrice));
  const patch = (i: number, p: Partial<Line>) => setLines(lines.map((l, li) => (li === i ? { ...l, ...p } : l)));

  // 取引先を選んだとき、宛名が空か前の取引先名のままなら、取引先名を入れる(自分で直した宛名は上書きしない)。
  function chooseClient(id: string) {
    const prevName = clients.find((c) => c.id === clientId)?.name ?? "";
    setClientId(id);
    const next = clients.find((c) => c.id === id)?.name ?? "";
    if (!addressee.trim() || addressee === prevName) setAddressee(next);
  }

  function submit(sendAfter: boolean) {
    setMsg(null);
    if (sendAfter) {
      if (!toList.length) return setMsg({ ok: false, text: "送付するには、送信先メールアドレスを入力するか、メールアドレスが登録された取引先を選んでください。（「保存だけ」なら入力なしで保存できます）" });
      const ok = window.confirm(`見積書（税込 ¥${totals.totalInclTax.toLocaleString("ja-JP")}）を保存して、\n${toText}\nへメール送付します。よろしいですか？`);
      if (!ok) return;
    }
    startTransition(async () => {
      const res = await saveEstimate(
        {
          clientId,
          issuedDate,
          addressee,
          storeName,
          recipientEmails,
          subject,
          note,
          taxMode,
          lines: lines.map((l) => ({ label: l.label, description: l.description, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 })),
        },
        sendAfter,
        existingId
      );
      if (res.ok) {
        router.push(`/admin/estimates/${res.id}`);
        router.refresh();
      } else if (res.id) {
        // 保存はできたが送付に失敗した: 詳細へ移動して、あとで送付できるようにする。
        window.alert(res.error);
        router.push(`/admin/estimates/${res.id}`);
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="mt-6 space-y-5">
      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-300">
            取引先（任意）
            <select value={clientId} onChange={(e) => chooseClient(e.target.value)} className={`${input} mt-1`}>
              <option value="">選ばない</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            発行日
            <input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} className={`${input} mt-1`} />
          </label>
          <label className="text-sm text-slate-300">
            会社名（宛名。「御中」は自動で付きます）
            <input value={addressee} onChange={(e) => setAddressee(e.target.value)} className={`${input} mt-1`} />
          </label>
          <label className="text-sm text-slate-300">
            店舗名
            <input value={storeName} onChange={(e) => setStoreName(e.target.value)} className={`${input} mt-1`} />
          </label>
          <label className="text-sm text-slate-300 md:col-span-2">
            送信先メールアドレス（複数はカンマ区切り。空なら取引先の登録を使います）
            <input type="text" inputMode="email" value={recipientEmails} onChange={(e) => setRecipientEmails(e.target.value)} placeholder="例: example@example.com" className={`${input} mt-1`} />
          </label>
          <label className="text-sm text-slate-300">
            件名
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={`${input} mt-1`} />
          </label>
        </div>
        {existingNumber && <p className="mt-3 text-xs text-slate-500">見積番号: {existingNumber}（修正しても番号は変わりません）</p>}
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-black">品目</h2>
          <div className="flex gap-2 text-sm">
            <button type="button" onClick={() => setTaxMode("EX")} className={`rounded-lg px-3 py-1.5 font-black ${taxMode === "EX" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>
              税別で入力
            </button>
            <button type="button" onClick={() => setTaxMode("INCL")} className={`rounded-lg px-3 py-1.5 font-black ${taxMode === "INCL" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>
              税込で入力
            </button>
          </div>
        </div>
        {taxMode === "INCL" && (
          <p className="mt-2 text-xs text-amber-300">税込で入力した単価は、税別（円未満切り捨て）に直して計算します。そのため合計が入力した金額と1円ずれることがあります。金額をそのまま出したいときは「税別で入力」を使ってください。</p>
        )}
        <div className="mt-3 space-y-3">
          {lines.map((l, i) => (
            <div key={l.key} className="rounded-xl border border-slate-700 p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_90px_160px_auto]">
                <input value={l.label} onChange={(e) => patch(i, { label: e.target.value })} placeholder="内容" className={input} />
                <NumInput value={l.quantity} onChange={(n) => patch(i, { quantity: n })} className={`${input} text-right`} />
                <NumInput value={l.unitPrice} onChange={(n) => patch(i, { unitPrice: n })} className={`${input} text-right`} />
                <button type="button" onClick={() => setLines(lines.filter((_, li) => li !== i))} disabled={lines.length <= 1} className="rounded-lg border border-red-700 px-3 py-2 text-sm font-black text-red-300 disabled:opacity-30">
                  削除
                </button>
              </div>
              <input value={l.description} onChange={(e) => patch(i, { description: e.target.value })} placeholder="補足（任意）" className={`${input} mt-2`} />
              <p className="mt-1 text-xs text-slate-500">内容 ／ 数量 ／ 単価（{taxMode === "EX" ? "税別" : "税込"}）</p>
            </div>
          ))}
          <button type="button" onClick={() => setLines([...lines, ...withKey([{ label: "", description: "", quantity: 1, unitPrice: 0 }])])} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white">
            ＋ 行を追加
          </button>
        </div>
        <div className="mt-4 text-right text-sm text-slate-300">
          <p>小計（税抜） ¥{totals.subtotalExTax.toLocaleString("ja-JP")}</p>
          <p>消費税（10%） ¥{totals.taxAmount.toLocaleString("ja-JP")}</p>
          <p className="text-lg font-black text-slate-100">合計（税込） ¥{totals.totalInclTax.toLocaleString("ja-JP")}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <label className="text-sm text-slate-300">
          備考（任意）
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className={`${input} mt-1`} />
        </label>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <p className="text-sm text-slate-300">「保存だけ」ではメールは送られません。「保存して送付」を押したときだけ、取引先へメールで送ります。</p>
        <p className="mt-1 text-xs text-slate-500">送付先: {toText || "（未設定。送信先メールアドレスを入力するか、取引先を選んでください）"}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={() => submit(false)} disabled={pending} className="rounded-2xl bg-[#14283b] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
            {pending ? "処理中..." : "保存だけ"}
          </button>
          <button type="button" onClick={() => submit(true)} disabled={pending} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
            {pending ? "処理中..." : "保存して送付（メール）"}
          </button>
        </div>
        {msg && <p className={`mt-3 text-sm font-bold ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      </section>
    </div>
  );
}
