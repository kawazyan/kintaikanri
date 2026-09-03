"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateStaff, adminBulkDeleteStaff, adminForceDeleteStaff } from "./actions";

const FIELD_CLASS =
  "rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

type StaffRow = {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  status: "ACTIVE" | "RETIRED";
  paymentMethod: "FIXED" | "REQUEST";
  updatedAt: Date;
};

export function StaffList({
  staffList,
  showRetired = false,
}: {
  staffList: StaffRow[];
  showRetired?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [blocked, setBlocked] = useState<{ id: string; name: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const allChecked = staffList.length > 0 && selected.size === staffList.length;

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(staffList.map((s) => s.id)));
  }

  function handleBulkDelete() {
    if (!selected.size) return;
    if (!window.confirm(`選択した${selected.size}名を削除します。打刻・シフト等の履歴があるスタッフは削除できません。元に戻せません。削除しますか？`)) return;
    startTransition(async () => {
      const idList = [...selected];
      const result = await adminBulkDeleteStaff(idList);
      setSelected(new Set());
      router.refresh();
      if (result.failed > 0) {
        const blockedList = result.blockedIds
          .map((id) => {
            const s = staffList.find((x) => x.id === id);
            return s ? { id: s.id, name: s.name } : null;
          })
          .filter((x): x is { id: string; name: string } => x !== null);
        setBlocked(blockedList);
        window.alert(`${result.deleted}名を削除しました。${result.failed}名は打刻・シフト等の履歴が残っているため削除できませんでした。強制削除する場合は下の案内をご確認ください。`);
      } else {
        setBlocked([]);
      }
    });
  }

  function handleForceDelete() {
    if (!blocked.length) return;
    const names = blocked.map((b) => b.name).join("・");
    if (
      !window.confirm(
        `${names} を完全に削除します。この操作は元に戻せません。\n\n` +
          `打刻履歴・シフト・経費申請・振込申請・獲得称号・皆勤賞など、このスタッフに紐づく全ての記録が完全に削除されます。\n` +
          `稼働依頼(取引先への請求実績)だけは削除せず、「スタッフ一覧外の稼働者」として残ります。\n\n` +
          `本当に削除しますか？`
      )
    )
      return;
    startTransition(async () => {
      const result = await adminForceDeleteStaff(blocked.map((b) => b.id));
      setBlocked([]);
      router.refresh();
      window.alert(`${result.deleted}名を完全に削除しました。${result.failed > 0 ? `${result.failed}名は削除できませんでした。` : ""}`);
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-red-800/70 bg-red-950/25 px-4 py-2.5 text-sm">
          <span className="font-black text-red-200">{selected.size}名を選択中</span>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={pending}
            className="rounded-lg border border-red-700 bg-red-950/40 px-3 py-1.5 text-xs font-black text-red-300 disabled:opacity-50"
          >
            選択した項目を削除
          </button>
        </div>
      )}
      {blocked.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-700/70 bg-amber-950/25 px-4 py-3 text-sm">
          <p className="font-black text-amber-200">
            {blocked.map((b) => b.name).join("・")} は打刻・シフト等の履歴が残っているため通常削除できません。
          </p>
          <p className="mt-1 text-xs text-amber-300/80">
            強制削除すると、このスタッフに紐づく打刻・シフト・経費申請・振込申請などの記録も完全に削除されます。元に戻せません。
          </p>
          <button
            type="button"
            onClick={handleForceDelete}
            disabled={pending}
            className="mt-2 rounded-lg border border-amber-600 bg-amber-950/40 px-3 py-1.5 text-xs font-black text-amber-200 disabled:opacity-50"
          >
            履歴ごと強制削除する
          </button>
        </div>
      )}
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
        <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="全選択" />
        全選択
      </div>
      <ul className="flex flex-col gap-3">
        {staffList.map((s) => (
          <li key={s.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 shadow-lg shadow-black/40 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggleOne(s.id)}
                aria-label="選択"
                className="mt-3 shrink-0"
              />
              <form
                key={s.updatedAt.getTime()}
                action={updateStaff.bind(null, s.id)}
                className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-5 sm:items-center"
              >
                <input type="hidden" name="showRetired" value={showRetired ? "1" : ""} />
                <input name="employeeCode" defaultValue={s.employeeCode} required className={FIELD_CLASS} />
                <input name="name" defaultValue={s.name} required className={FIELD_CLASS} />
                <input name="email" type="email" defaultValue={s.email} required className={FIELD_CLASS} />
                <select name="status" defaultValue={s.status} className={FIELD_CLASS}>
                  <option value="ACTIVE">在籍中</option>
                  <option value="RETIRED">退職済み</option>
                </select>
                <button type="submit" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 active:scale-[0.98]">
                  保存
                </button>
              </form>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>支払方法: {s.paymentMethod === "FIXED" ? "固定支払" : "申請支払"}</span>
              <Link href={`/admin/staff/${s.id}`} className="text-blue-400 underline">
                詳細・銀行口座・支払方法を編集
              </Link>
            </div>
          </li>
        ))}
        {staffList.length === 0 && <p className="text-sm text-slate-500">スタッフが登録されていません。</p>}
      </ul>
    </div>
  );
}
