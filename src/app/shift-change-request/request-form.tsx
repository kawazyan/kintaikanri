"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { submitShiftChangeRequest, type ShiftChangeRequestInput } from "./actions";
import { SHIFT_CHANGE_KIND_OPTIONS, SHIFT_CHANGE_KIND_LABEL } from "@/lib/attendance-requests";

const EMPTY: ShiftChangeRequestInput = {
  targetDate: "",
  kind: "DATE_CHANGE",
  reason: "",
  newDate: "",
  newStartTime: "",
  newEndTime: "",
  newLocation: "",
  transferDate: "",
  approvalConfirmed: false,
};

function formatMonthDay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [, m, d] = value.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

export function RequestForm() {
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [input, setInput] = useState<ShiftChangeRequestInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleContinue() {
    setError(null);
    if (!input.targetDate) return setError("変更対象日を選択してください");
    if (!input.reason.trim()) return setError("変更理由を入力してください");
    if (input.kind === "DATE_CHANGE" && !input.newDate) return setError("変更後の勤務日を選択してください");
    if (input.kind === "TIME_CHANGE" && (!input.newStartTime || !input.newEndTime))
      return setError("変更後の勤務時間を入力してください");
    if (input.kind === "LOCATION_CHANGE" && !input.newLocation.trim())
      return setError("変更後の勤務場所を入力してください");
    if (input.kind === "TRANSFER" && !input.transferDate) return setError("振替日を選択してください");
    if (!input.approvalConfirmed) return setError("関係者への確認・承認を行ったうえで同意チェックを入れてください");
    setStep("confirm");
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await submitShiftChangeRequest(input);
      if ("error" in result) {
        setError(result.error);
        setStep("form");
        return;
      }
      setStep("done");
      router.refresh();
    });
  }

  if (step === "done") {
    return (
      <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-black text-slate-900">申請を送信しました。</p>
        <p className="mt-2 text-xs font-bold text-slate-500">管理者の承認後、シフトへ反映されます。</p>
        <button
          type="button"
          onClick={() => {
            setInput(EMPTY);
            setStep("form");
          }}
          className="mt-4 w-full rounded-2xl bg-[#b91c1c] py-3 text-sm font-black text-white shadow-[0_4px_0_#7f1d1d]"
        >
          続けて申請する
        </button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-black text-slate-900">この内容で申請しますか？</p>
        <dl className="space-y-2 text-sm">
          <ConfirmRow label="変更対象" value={formatMonthDay(input.targetDate)} />
          <ConfirmRow label="変更内容" value={SHIFT_CHANGE_KIND_LABEL[input.kind]} />
          {input.kind === "DATE_CHANGE" && <ConfirmRow label="変更後の勤務日" value={formatMonthDay(input.newDate)} />}
          {input.kind === "TIME_CHANGE" && (
            <ConfirmRow label="変更後の勤務時間" value={`${input.newStartTime} 〜 ${input.newEndTime}`} />
          )}
          {input.kind === "LOCATION_CHANGE" && <ConfirmRow label="変更後の勤務場所" value={input.newLocation} />}
          {input.kind === "TRANSFER" && <ConfirmRow label="振替日" value={formatMonthDay(input.transferDate)} />}
          <ConfirmRow label="理由" value={input.reason} multiline />
          <ConfirmRow label="関係者承認" value="確認済み" />
        </dl>
        {error && <p className="text-xs font-bold text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setStep("form")}
            disabled={pending}
            className="w-1/3 rounded-2xl border border-slate-300 py-3 text-sm font-black text-slate-600"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="w-2/3 rounded-2xl bg-[#b91c1c] py-3 text-sm font-black text-white shadow-[0_4px_0_#7f1d1d] disabled:opacity-60"
          >
            {pending ? "送信中..." : "この内容で申請する"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <label className="block text-xs font-black">
        変更対象日(現在のシフトの日付)
        <input
          type="date"
          required
          value={input.targetDate}
          onChange={(e) => setInput({ ...input, targetDate: e.target.value })}
          className="mt-1 w-full rounded-xl border p-3 text-sm"
        />
      </label>

      <label className="block text-xs font-black">
        変更希望内容
        <select
          value={input.kind}
          onChange={(e) => setInput({ ...input, kind: e.target.value as ShiftChangeRequestInput["kind"] })}
          className="mt-1 w-full rounded-xl border p-3 text-sm"
        >
          {SHIFT_CHANGE_KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {input.kind === "DATE_CHANGE" && (
        <label className="block text-xs font-black">
          変更後の勤務日
          <input
            type="date"
            value={input.newDate}
            onChange={(e) => setInput({ ...input, newDate: e.target.value })}
            className="mt-1 w-full rounded-xl border p-3 text-sm"
          />
        </label>
      )}

      {input.kind === "TIME_CHANGE" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-black">
            変更後の開始時刻
            <input
              type="time"
              value={input.newStartTime}
              onChange={(e) => setInput({ ...input, newStartTime: e.target.value })}
              className="mt-1 w-full rounded-xl border p-3 text-sm"
            />
          </label>
          <label className="block text-xs font-black">
            変更後の終了時刻
            <input
              type="time"
              value={input.newEndTime}
              onChange={(e) => setInput({ ...input, newEndTime: e.target.value })}
              className="mt-1 w-full rounded-xl border p-3 text-sm"
            />
          </label>
        </div>
      )}

      {input.kind === "LOCATION_CHANGE" && (
        <label className="block text-xs font-black">
          変更後の勤務場所
          <input
            type="text"
            value={input.newLocation}
            onChange={(e) => setInput({ ...input, newLocation: e.target.value })}
            placeholder="例: 〇〇店"
            className="mt-1 w-full rounded-xl border p-3 text-sm"
          />
        </label>
      )}

      {input.kind === "TRANSFER" && (
        <label className="block text-xs font-black">
          振替日
          <input
            type="date"
            value={input.transferDate}
            onChange={(e) => setInput({ ...input, transferDate: e.target.value })}
            className="mt-1 w-full rounded-xl border p-3 text-sm"
          />
        </label>
      )}

      <label className="block text-xs font-black">
        変更理由
        <textarea
          required
          rows={3}
          value={input.reason}
          onChange={(e) => setInput({ ...input, reason: e.target.value })}
          placeholder="調整済みの経緯を入力してください"
          className="mt-1 w-full rounded-xl border p-3 text-sm"
        />
      </label>

      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-[11px] font-bold leading-relaxed text-amber-900">
        <div className="mb-1 flex items-center gap-1.5 text-amber-700">
          <AlertTriangle size={13} />
          <span>関係者への確認・承認を行わず、システム上の申請のみでシフト変更を行うことはできません。</span>
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs font-bold text-slate-700">
        <input
          type="checkbox"
          checked={input.approvalConfirmed}
          onChange={(e) => setInput({ ...input, approvalConfirmed: e.target.checked })}
          className="mt-0.5"
        />
        稼働先責任者・クライアント及び社内担当上長から必要な承認を受けたうえで申請します。
      </label>

      {error && <p className="text-xs font-bold text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!input.approvalConfirmed}
        className="w-full rounded-2xl bg-[#b91c1c] py-3 text-sm font-black text-white shadow-[0_4px_0_#7f1d1d] disabled:cursor-not-allowed disabled:opacity-40"
      >
        確認画面へ
      </button>
    </div>
  );
}

function ConfirmRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-black text-slate-400">【{label}】</dt>
      <dd className={`font-bold text-slate-900 ${multiline ? "whitespace-pre-line" : ""}`}>{value}</dd>
    </div>
  );
}
