"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

const jstToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date()); // YYYY-MM-DD
const label = (ymd: string) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).format(
    new Date(`${ymd}T00:00:00+09:00`)
  );

// 「振込完了」ボタン。押した日(JST)が予定日と違うときだけ、確認ダイアログで警告する。
//  固定支払 = 支払い予定日(前倒し後) / 申請支払 = 希望振込日。同じ日なら今までどおり1回で記録する。
// 振込日として記録されるのは「押した日時」。警告が出たら、本当にその日の振込として記録してよいか確認する。
export function PaidConfirmButton({
  expectedDate,
  expectedLabel,
  staffName,
  amountText,
  className,
  pendingText = "記録中…",
  children,
}: {
  expectedDate: string; // 予定日(JST の YYYY-MM-DD)
  expectedLabel: string; // 「支払い予定日」「希望振込日」
  staffName: string;
  amountText: string; // 例: "263,200円"(金額が空欄のときは申請額)
  className?: string;
  pendingText?: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        const today = jstToday();
        if (today === expectedDate) return;
        const gap = today < expectedDate ? `${expectedLabel}より前` : `${expectedLabel}を過ぎています`;
        const ok = window.confirm(
          `【警告】${expectedLabel}と違う日の振込です。\n\n` +
            `${staffName}さん ${amountText}\n` +
            `${expectedLabel}: ${label(expectedDate)}\n` +
            `今日(記録される振込日): ${label(today)}(${gap})\n\n` +
            `この日の振込として記録します。よろしいですか？`
        );
        if (!ok) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
