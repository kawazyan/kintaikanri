"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

// 押す前に確認を出す送信ボタン(振込済みの取り消しなど、間違えると記録が変わる操作用)。
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={className}
    >
      {pending ? "処理中…" : children}
    </button>
  );
}
