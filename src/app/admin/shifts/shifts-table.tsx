"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatJst } from "@/lib/time";
import { WORK_TYPE_LABEL } from "@/lib/carriers";
import {
  adminDeleteShift,
  adminBulkDeleteShifts,
  adminRestoreShift,
  adminRegisterClockByShift,
} from "./actions";

type ShiftRow = {
  id: string;
  workType: "BAND" | "SPOT";
  startTime: Date;
  endTime: Date;
  carrier: string;
  storeName: string;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  staff: { name: string; employeeCode: string };
  clockRecords: { type: "IN" | "OUT" }[];
};

// 代理打刻(シフト通り)が必要な状態かどうかの表示用。
function clockStatus(s: ShiftRow): { label: string; missing: boolean } {
  const hasIn = s.clockRecords.some((r) => r.type === "IN");
  const hasOut = s.clockRecords.some((r) => r.type === "OUT");
  if (hasIn && hasOut) return { label: "打刻済", missing: false };
  if (hasIn) return { label: "退勤なし", missing: true };
  if (hasOut) return { label: "出勤なし", missing: true };
  return { label: "打刻なし", missing: true };
}

export function ShiftsTable({ shifts }: { shifts: ShiftRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  // 画面を開いた時点の時刻。終了前のシフトにはボタンを出さない(サーバー側でも拒否する)。
  const [now] = useState(() => Date.now());

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

  function handleRestore(id: string) {
    if (!window.confirm("このシフトのキャンセルを取り消しますか? 打刻がすでに紐付いていれば、勤務スタンプ・確定受取金額の集計対象に戻ります。")) return;
    startTransition(async () => {
      await adminRestoreShift(id);
      router.refresh();
    });
  }

  function handleRegisterClock(s: ShiftRow) {
    const hasIn = s.clockRecords.some((r) => r.type === "IN");
    const hasOut = s.clockRecords.some((r) => r.type === "OUT");
    const lines = [
      !hasIn ? `出勤 ${formatJst(s.startTime)}` : null,
      !hasOut ? `退勤 ${formatJst(s.endTime)}` : null,
    ].filter(Boolean);
    if (
      !window.confirm(
        `${s.staff.name}さんの打刻を、シフト通りに代理登録します。\n${lines.join("\n")}\n(すでにある打刻は変更しません)\nよろしいですか?`
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await adminRegisterClockByShift(s.id);
      if (result.ok) {
        setMessage({
          ok: true,
          text: `${s.staff.name}さんの${result.created.map((t) => (t === "IN" ? "出勤" : "退勤")).join("・")}を登録しました。`,
        });
      } else {
        setMessage({ ok: false, text: result.error });
      }
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
      {message && (
        <div
          className={`mb-3 rounded-xl border px-4 py-2.5 text-sm font-bold ${
            message.ok
              ? "border-emerald-700 bg-emerald-950/30 text-emerald-200"
              : "border-red-700 bg-red-950/30 text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}
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
        <table className="w-full min-w-[960px] text-left text-sm">
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
              <th className="py-2 pr-3">状態</th>
              <th className="py-2 pr-3">打刻</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className={`border-b border-slate-800/60 text-slate-200 ${s.cancelledAt ? "opacity-60" : ""}`}>
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
                <td className="py-2 pr-3">
                  {s.cancelledAt ? (
                    <span
                      className="rounded bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400"
                      title={s.cancellationReason ?? ""}
                    >
                      キャンセル済み
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {s.cancelledAt ? (
                    "-"
                  ) : (
                    <span className={clockStatus(s).missing ? "text-amber-300" : "text-slate-400"}>
                      {clockStatus(s).label}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {!s.cancelledAt && clockStatus(s).missing && s.endTime.getTime() <= now && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRegisterClock(s)}
                        disabled={pending}
                        className="text-amber-300 underline disabled:opacity-50"
                      >
                        シフト通りに打刻
                      </button>{" "}
                    </>
                  )}
                  <Link href={`/admin/shifts/${s.id}`} className="text-blue-400 underline">
                    編集
                  </Link>{" "}
                  {s.cancelledAt ? (
                    <button type="button" onClick={() => handleRestore(s.id)} disabled={pending} className="text-emerald-400 underline disabled:opacity-50">
                      キャンセル取消
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleDeleteOne(s.id)} disabled={pending} className="text-red-400 underline disabled:opacity-50">
                      削除
                    </button>
                  )}
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
