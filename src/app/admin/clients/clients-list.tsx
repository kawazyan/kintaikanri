"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Copy, Eye, Mail, Phone, UserRound } from "lucide-react";
import { adminBulkDeleteClients, adminIssueClientViewToken, adminRevokeClientViewToken } from "./actions";

type ClientRow = {
  id: string;
  name: string;
  contactName: string | null;
  contactDepartment: string | null;
  phone: string | null;
  email: string | null;
  _count: { workOrders: number; invoices: number };
  viewUrl: string | null; // 出退勤の閲覧専用ページのURL(未発行はnull)
};

// 取引先に渡す「出退勤の閲覧専用ページ」のURL。グループLINEなどに1回貼って案内する。
function ViewUrlBox({ client }: { client: ClientRow }) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "失敗しました。");
      }
    });
  }
  async function copy() {
    if (!client.viewUrl) return;
    try {
      await navigator.clipboard.writeText(client.viewUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("URLをコピーしてください", client.viewUrl);
    }
  }

  return (
    <div className="mt-4 rounded-2xl bg-slate-50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-black text-slate-500"><Eye size={14} />出退勤の閲覧ページ（取引先用・閲覧のみ）</p>
      {client.viewUrl ? (
        <>
          <a href={client.viewUrl} target="_blank" rel="noreferrer" className="mt-1.5 block break-all text-xs font-bold text-slate-700 underline decoration-slate-300 underline-offset-2">{client.viewUrl}</a>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="flex items-center gap-1 rounded-lg bg-[#14283b] px-3 py-1.5 text-xs font-black text-white"><Copy size={13} />{copied ? "コピーしました" : "URLをコピー"}</button>
            <button type="button" disabled={pending} onClick={() => { if (window.confirm("URLを再発行します。これまでのURLは使えなくなります。よろしいですか？")) run(() => adminIssueClientViewToken(client.id)); }} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-black text-slate-600 disabled:opacity-50">再発行</button>
            <button type="button" disabled={pending} onClick={() => { if (window.confirm("閲覧ページを停止します。URLを開いても見られなくなります。よろしいですか？")) run(() => adminRevokeClientViewToken(client.id)); }} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-600 disabled:opacity-50">停止</button>
          </div>
        </>
      ) : (
        <button type="button" disabled={pending} onClick={() => run(() => adminIssueClientViewToken(client.id))} className="mt-2 rounded-lg bg-[#14283b] px-3 py-1.5 text-xs font-black text-white disabled:opacity-50">{pending ? "発行中…" : "URLを発行する"}</button>
      )}
    </div>
  );
}

export function ClientsList({ clients }: { clients: ClientRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const allChecked = clients.length > 0 && selected.size === clients.length;

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(clients.map((c) => c.id)));
  }

  function handleBulkDelete() {
    if (!selected.size) return;
    if (!window.confirm(`選択した${selected.size}社を削除します。稼働依頼・請求書が紐付いた取引先は削除されません。元に戻せません。削除しますか？`)) return;
    startTransition(async () => {
      const result = await adminBulkDeleteClients([...selected]);
      setSelected(new Set());
      router.refresh();
      if (result.blocked > 0) {
        window.alert(`${result.deleted}社を削除しました。${result.blocked}社は稼働依頼・請求書が紐付いているため削除できませんでした。`);
      }
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm">
          <span className="font-black text-red-700">{selected.size}社を選択中</span>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={pending}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-black text-red-600 disabled:opacity-50"
          >
            {pending ? "削除中…" : "選択した項目を削除"}
          </button>
        </div>
      )}
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-400">
        <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="全選択" />
        全選択
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {clients.map((c) => (
          <article key={c.id} className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} aria-label="選択" className="mt-1 shrink-0" />
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef2f5] text-[#14283b]">
                  <Building2 size={20} />
                </span>
                <div>
                  <h3 className="font-black">{c.name}</h3>
                  <p className="text-xs font-bold text-slate-400">
                    稼働依頼 {c._count.workOrders}件 ・ 請求 {c._count.invoices}件
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm font-bold text-slate-600">
              <p className="flex items-center gap-2">
                <UserRound size={15} />
                {c.contactDepartment ? `${c.contactDepartment} / ` : ""}
                {c.contactName || "担当者未設定"}
              </p>
              {c.phone && (
                <p className="flex items-center gap-2">
                  <Phone size={15} />
                  {c.phone}
                </p>
              )}
              {c.email && (
                <p className="flex items-center gap-2">
                  <Mail size={15} />
                  {c.email}
                </p>
              )}
            </div>
            <Link href={`/admin/clients/${c.id}/contracts`} className="mt-4 block rounded-2xl bg-[#14283b] px-4 py-3 text-center text-sm font-black text-white">契約(スタッフ×店舗×単価)を登録・確認</Link>
            <ViewUrlBox client={c} />
          </article>
        ))}
        {!clients.length && (
          <div className="rounded-[24px] bg-white p-8 text-center text-sm font-bold text-slate-400 ring-1 ring-black/5 md:col-span-2">
            取引先から依頼が届くと、ここへ自動的に表示されます。
          </div>
        )}
      </div>
    </div>
  );
}
