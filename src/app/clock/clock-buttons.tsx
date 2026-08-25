"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { clockAction } from "./actions";

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    let done = false;
    const finish = (value: GeolocationPosition | null) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    // Safety net in case a browser ignores the API's own timeout option.
    const fallbackTimer = setTimeout(() => finish(null), 12000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(fallbackTimer);
        finish(pos);
      },
      () => {
        clearTimeout(fallbackTimer);
        finish(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export function ClockButtons({
  canClockOut,
  finishedToday,
}: {
  canClockOut: boolean;
  finishedToday: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean; warning?: string } | null>(
    null
  );
  const router = useRouter();

  const mode: "IN" | "OUT" = canClockOut ? "OUT" : "IN";

  async function handleClock() {
    setBusy(true);
    setMessage(null);

    let latitude: number | null = null;
    let longitude: number | null = null;
    try {
      const pos = await getPosition();
      latitude = pos?.coords.latitude ?? null;
      longitude = pos?.coords.longitude ?? null;
    } catch {
      // ignore; clock in/out proceeds without location
    }

    startTransition(async () => {
      try {
        const result = await clockAction(mode, latitude, longitude);
        if (result.ok) {
          setMessage({
            text: `${mode === "IN" ? "出勤" : "退勤"}を記録しました${
              result.storeName ? `(${result.storeName})` : ""
            }`,
            ok: true,
            warning: result.warning ?? undefined,
          });
          router.refresh();
        } else {
          setMessage({ text: result.error, ok: false });
        }
      } catch {
        setMessage({
          text: "通信エラーが発生しました。もう一度お試しください。",
          ok: false,
        });
      } finally {
        setBusy(false);
      }
    });
  }

  const isBusy = pending || busy;

  if (finishedToday) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-slate-950/70 py-6 shadow-[0_4px_16px_rgba(0,0,0,0.5)] ring-1 ring-slate-700/60 backdrop-blur-sm">
        <CheckCircle2 size={26} className="text-emerald-400" />
        <p className="text-sm font-semibold text-slate-200">本日の勤務は終了しました</p>
      </div>
    );
  }

  const label = mode === "IN" ? "出勤する" : "退勤する";
  const Icon = mode === "IN" ? LogIn : LogOut;
  const gradient =
    mode === "IN"
      ? "from-emerald-300 via-emerald-500 to-emerald-700"
      : "from-red-400 via-[#e0272e] to-red-800";
  const glow = mode === "IN" ? "rgba(16,185,129,0.55)" : "rgba(220,38,38,0.55)";

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={isBusy}
        onClick={handleClock}
        style={{
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -3px 6px rgba(0,0,0,0.25), 0 6px 18px ${glow}, 0 3px 8px rgba(0,0,0,0.5)`,
        }}
        className={`relative flex w-full max-w-[280px] items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-b ${gradient} py-4 text-lg font-bold text-white transition active:scale-[0.97] disabled:opacity-50`}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/40 to-transparent" />
        <Icon size={22} strokeWidth={2.4} className="relative" />
        <span className="relative">{isBusy ? "記録中..." : label}</span>
      </button>
      {message && (
        <div className="flex flex-col items-center gap-1">
          <p className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}>
            {message.text}
          </p>
          {message.warning && <p className="text-sm font-medium text-red-400">{message.warning}</p>}
        </div>
      )}
    </div>
  );
}
