"use client";

import { useEffect, useRef } from "react";

const KEY = "kintai_operator_name";

// 管理画面の「操作者名」欄(変更履歴に残る名前)。前回入力した名前をこのブラウザに覚えて、次回から自動で入れる。
// 管理画面は共通パスワードで個人を区別できないため、誰が変更したかはこの名前で記録する。
export function OperatorNameInput({ className, placeholder = "操作者名" }: { className?: string; placeholder?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved && ref.current && !ref.current.value) ref.current.value = saved;
    } catch {
      // 保存済みの名前が読めなくても、手入力はできる
    }
  }, []);
  return (
    <input
      ref={ref}
      type="text"
      name="operatorName"
      placeholder={placeholder}
      aria-label="操作者名(変更履歴に残ります)"
      onChange={(e) => {
        try {
          window.localStorage.setItem(KEY, e.target.value.trim());
        } catch {
          // 保存できなくても入力は有効
        }
      }}
      className={className}
    />
  );
}
