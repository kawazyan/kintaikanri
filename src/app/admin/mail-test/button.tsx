"use client";

import { useState, useTransition } from "react";
import { sendTestMail } from "./actions";

export function TestMailButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="mt-5">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMessage(null);
            const res = await sendTestMail();
            setMessage(
              res.ok
                ? { ok: true, text: `送信しました(差出人: ${res.from})。受信箱と迷惑メールフォルダを確認してください。` }
                : { ok: false, text: res.error },
            );
          })
        }
        className="rounded-xl bg-red-600 px-5 py-2 font-black text-white"
      >
        {pending ? "送信中…" : "テストメールを送る"}
      </button>
      {message && (
        <p className={`mt-3 text-sm font-bold ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</p>
      )}
    </div>
  );
}
