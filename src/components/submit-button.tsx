"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// 素の<form action={...}>にそのまま置ける送信ボタン。フォームの送信中は
// useFormStatus() が自動的にpendingを返すので、ボタン単体をこれに差し替える
// だけで「送信中…」表示と連打防止(disabled)が両方手に入る。
export function SubmitButton({
  children,
  pendingText = "送信中…",
  ...props
}: {
  children: ReactNode;
  pendingText?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} {...props}>
      {pending ? pendingText : children}
    </button>
  );
}
