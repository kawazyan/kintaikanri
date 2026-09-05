"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { submitIrregularReport, type IrregularReportInput } from "./actions";
import { IRREGULAR_REPORT_TYPE_OPTIONS, IRREGULAR_REPORT_TYPE_LABEL } from "@/lib/attendance-requests";

const EMPTY: IrregularReportInput = {
  targetDate: "",
  reportType: "LATE",
  reason: "",
  details: "",
  changedTime: "",
  changedLocation: "",
};

export function ReportForm() {
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [input, setInput] = useState<IrregularReportInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleContinue() {
    setError(null);
    if (!input.targetDate) return setError("対象日を選択してください");
    if (!input.reason.trim()) return setError("理由を入力してください");
    if (!input.details.trim()) return setError("詳細を入力してください");
    setStep("confirm");
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await submitIrregularReport(input);
      if ("error" in result) {
        setError(result.error);
        setStep("form");
        return;
      }
      setStep("done");
      router.refresh();
    });
  }

  const noticeBox = (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold leading-relaxed text-amber-900">
      <div className="mb-1 flex items-center gap-1.5 text-amber-700">
        <AlertTriangle size={15} />
        <span className="text-sm font-black">重要な注意事項</span>
      </div>
      勤務予定に変更・問題が発生した場合はこちらから報告してください。
      <br />
      本フォームへの報告のみで連絡が完了するものではありません。
      <br />
      必要に応じて、稼働先責任者・クライアント・担当上長・グループLINE等への報告・連絡も必ず行ってください。
    </div>
  );

  if (step === "done") {
    return (
      <div className="space-y-4">
        {noticeBox}
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-sm font-black text-slate-900">報告を送信しました。</p>
          <p className="mt-2 text-xs font-bold text-slate-500">
            この報告のみで会社への連絡が完了したわけではありません。必要な連絡・報告は別途必ず行ってください。
          </p>
          <button
            type="button"
            onClick={() => {
              setInput(EMPTY);
              setStep("form");
            }}
            className="mt-4 w-full rounded-2xl bg-[#b91c1c] py-3 text-sm font-black text-white shadow-[0_4px_0_#7f1d1d]"
          >
            続けて報告する
          </button>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="space-y-4">
        {noticeBox}
        <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <p className="text-sm font-black text-slate-900">この内容で報告しますか？</p>
          <dl className="space-y-2 text-sm">
            <ConfirmRow label="対象日" value={input.targetDate} />
            <ConfirmRow label="報告種類" value={IRREGULAR_REPORT_TYPE_LABEL[input.reportType]} />
            <ConfirmRow label="理由" value={input.reason} />
            <ConfirmRow label="詳細" value={input.details} multiline />
            {input.changedTime && <ConfirmRow label="変更後の予定時間" value={input.changedTime} />}
            {input.changedLocation && <ConfirmRow label="変更後の勤務場所" value={input.changedLocation} />}
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
              {pending ? "送信中..." : "この内容で報告する"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {noticeBox}
      <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <label className="block text-xs font-black">
          対象日
          <input
            type="date"
            required
            value={input.targetDate}
            onChange={(e) => setInput({ ...input, targetDate: e.target.value })}
            className="mt-1 w-full rounded-xl border p-3 text-sm"
          />
        </label>

        <label className="block text-xs font-black">
          報告種類
          <select
            value={input.reportType}
            onChange={(e) => setInput({ ...input, reportType: e.target.value as IrregularReportInput["reportType"] })}
            className="mt-1 w-full rounded-xl border p-3 text-sm"
          >
            {IRREGULAR_REPORT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-black">
          理由
          <input
            type="text"
            required
            value={input.reason}
            onChange={(e) => setInput({ ...input, reason: e.target.value })}
            placeholder="例: 電車の遅延"
            className="mt-1 w-full rounded-xl border p-3 text-sm"
          />
        </label>

        <label className="block text-xs font-black">
          詳細
          <textarea
            required
            rows={4}
            value={input.details}
            onChange={(e) => setInput({ ...input, details: e.target.value })}
            placeholder="状況を具体的に入力してください"
            className="mt-1 w-full rounded-xl border p-3 text-sm"
          />
        </label>

        <label className="block text-xs font-black">
          変更後の予定時間(該当する場合のみ)
          <input
            type="text"
            value={input.changedTime}
            onChange={(e) => setInput({ ...input, changedTime: e.target.value })}
            placeholder="例: 10:00出勤に変更"
            className="mt-1 w-full rounded-xl border p-3 text-sm"
          />
        </label>

        <label className="block text-xs font-black">
          変更後の勤務場所(該当する場合のみ)
          <input
            type="text"
            value={input.changedLocation}
            onChange={(e) => setInput({ ...input, changedLocation: e.target.value })}
            placeholder="例: 〇〇店"
            className="mt-1 w-full rounded-xl border p-3 text-sm"
          />
        </label>

        {error && <p className="text-xs font-bold text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleContinue}
          className="w-full rounded-2xl bg-[#b91c1c] py-3 text-sm font-black text-white shadow-[0_4px_0_#7f1d1d]"
        >
          確認画面へ
        </button>
      </div>
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
