"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { cancelClockRecord } from "./actions";

const WINDOW_MS = 5 * 60 * 1000;

export function CancelPunchButton({
  recordId,
  timestamp,
}: {
  recordId: string;
  timestamp: string; // ISO instant
}) {
  // Starts null and fills in on mount for the same hydration-mismatch
  // reason as LiveClock: the remaining time is a function of "now".
  const [now, setNow] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const intervalId = setInterval(tick, 1000);
    const timeoutId = setTimeout(tick, 0);
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, []);

  if (now === null) return null;

  const elapsedMs = now - new Date(timestamp).getTime();
  if (elapsedMs > WINDOW_MS) {
    return <p className="text-[11px] text-slate-500">5分経過後は管理者に修正を依頼してください</p>;
  }

  const remainingSec = Math.max(0, Math.ceil((WINDOW_MS - elapsedMs) / 1000));
  const remainingLabel = `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, "0")}`;

  async function handleCancel() {
    if (!window.confirm("直近の打刻を取り消しますか?")) return;
    setPending(true);
    const result = await cancelClockRecord(recordId);
    setPending(false);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={pending}
      className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 transition active:scale-95 disabled:opacity-50"
    >
      <RotateCcw size={11} />
      {pending ? "取り消し中..." : `やり直す(あと${remainingLabel})`}
    </button>
  );
}
