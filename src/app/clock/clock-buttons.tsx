"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  canClockIn,
  canClockOut,
}: {
  canClockIn: boolean;
  canClockOut: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [busyType, setBusyType] = useState<"IN" | "OUT" | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean; warning?: string } | null>(
    null
  );
  const router = useRouter();

  async function handleClock(type: "IN" | "OUT") {
    setBusyType(type);
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
        const result = await clockAction(type, latitude, longitude);
        if (result.ok) {
          setMessage({
            text: `${type === "IN" ? "出勤" : "退勤"}を記録しました${
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
        setBusyType(null);
      }
    });
  }

  const busy = pending || busyType !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy || !canClockIn}
          onClick={() => handleClock("IN")}
          className="flex-1 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 py-7 text-lg font-bold text-white shadow-lg shadow-emerald-950/50 transition active:scale-[0.98] disabled:opacity-40"
        >
          {busyType === "IN" ? "記録中..." : "出勤"}
        </button>
        <button
          type="button"
          disabled={busy || !canClockOut}
          onClick={() => handleClock("OUT")}
          className="flex-1 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 py-7 text-lg font-bold text-white shadow-lg shadow-blue-950/50 transition active:scale-[0.98] disabled:opacity-40"
        >
          {busyType === "OUT" ? "記録中..." : "退勤"}
        </button>
      </div>
      {message && (
        <div className="flex flex-col gap-1">
          <p className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}>
            {message.text}
          </p>
          {message.warning && <p className="text-sm font-medium text-red-400">{message.warning}</p>}
        </div>
      )}
    </div>
  );
}
