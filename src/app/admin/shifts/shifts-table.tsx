"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatJst } from "@/lib/time";
import { WORK_TYPE_LABEL } from "@/lib/carriers";
import { adminDeleteShift, adminBulkDeleteShifts } from "./actions";

type ShiftRow = {
  id: string;
  workType: "BAND" | "SPOT";
  startTime: Date;
  endTime: Date;
  carrier: string;
  storeName: string;
  staff: { name: string; employeeCode: string };
};

export function ShiftsTable({ shifts }: { shifts: ShiftRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const allChecked = shifts.length > 0 && selected.size === shifts.length;

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(shifts.map((s) => s.id)));
  }

  function handleDeleteOne(id: string) {
    if (!window.confirm("このシフトを削除しますか?")) return;
    startTransition(async () => {
      await adminDeleteShift(id);
      router.refresh();
    });
  }

  function handleBulkDelete() {
    if (!selected.size) return;
    if (!window.confirm(`選択した${selected.size}件のシフトを削除します。元に戻せません。削除しますか？`)) return;
    startTransition(async () => {
      await adminBulkDeleteShifts([...selected]);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-red-800/70 bg-red-950/25 px-4 py-2.5 text-sm">
          <span className="font-black text-red-200">{selected.size}件を選択中</span>
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
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500">
              <th className="w-10 py-2 pl-4">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="全選択" />
              </th>
              <th className="py-2 pr-3">スタッフ</th>
              <th className="py-2 pr-3">区分</th>
              <th className="py-2 pr-3">開始</th>
              <th className="py-2 pr-3">終了</th>
              <th className="py-2 pr-3">キャリア</th>
              <th className="py-2 pr-3">店舗</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className="border-b border-slate-800/60 text-slate-200">
                <td className="py-2 pl-4">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} aria-label="選択" />
                </td>
                <td className="py-2 pr-3">
                  {s.staff.name}({s.staff.employeeCode})
                </td>
                <td className="py-2 pr-3">{WORK_TYPE_LABEL[s.workType]}</td>
                <td className="py-2 pr-3">{formatJst(s.startTime)}</td>
                <td className="py-2 pr-3">{formatJst(s.endTime)}</td>
                <td className="py-2 pr-3">{s.carrier}</td>
                <td className="py-2 pr-3">{s.storeName}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  <Link href={`/admin/shifts/${s.id}`} className="text-blue-400 underline">
                    編集
                  </Link>{" "}
                  <button type="button" onClick={() => handleDeleteOne(s.id)} disabled={pending} className="text-red-400 underline disabled:opacity-50">
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shifts.length === 0 && <p className="p-4 text-sm text-slate-500">シフトが登録されていません。</p>}
      </div>
    </div>
  );
}
