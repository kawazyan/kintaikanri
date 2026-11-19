import { formatJst } from "@/lib/time";

export type SendLogRow = { id: string; kind: string; sentAt: Date; toEmails: string; ccEmails: string | null; addedEmails: string | null; savedTo: string | null };

// 送付履歴(初回送信・再送)。新しい順。履歴テーブルができる前に送った請求は、請求に残っている送付日時・宛先を「初回送信」として出す。
export function SendHistory({ logs, legacy }: { logs: SendLogRow[]; legacy: { sentAt: Date; sentTo: string | null } | null }) {
  const rows: { key: string; at: Date; label: string; to: string; note?: string }[] = logs.map((l) => ({
    key: l.id,
    at: l.sentAt,
    label: l.kind === "RESEND" ? "再送" : "初回送信",
    to: l.toEmails + (l.ccEmails ? `（CC: ${l.ccEmails}）` : ""),
    note: l.addedEmails ? `追加した宛先: ${l.addedEmails}${l.savedTo ? `（${l.savedTo === "CLIENT" ? "取引先に保存" : "この請求に保存"}）` : "（保存なし）"}` : undefined,
  }));
  if (legacy && !logs.some((l) => l.kind === "SEND")) rows.push({ key: "legacy", at: legacy.sentAt, label: "初回送信", to: legacy.sentTo ?? "（宛先の記録なし）" });
  rows.sort((a, b) => b.at.getTime() - a.at.getTime());
  if (!rows.length) return null;
  return (
    <section className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <h2 className="font-black">送付履歴</h2>
      <ul className="mt-2 divide-y divide-slate-800 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="py-2">
            <p className="text-xs text-slate-400">
              {formatJst(r.at)}　<span className="rounded-full bg-slate-800 px-2 py-0.5 font-black text-slate-100">{r.label}</span>
            </p>
            <p className="mt-1 break-all">{r.to}</p>
            {r.note && <p className="mt-1 text-xs text-amber-300">{r.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
