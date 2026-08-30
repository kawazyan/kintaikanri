"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
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
}: {
  canClockOut: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean; warning?: string } | null>(null);
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
      // 打刻自体は位置情報なしでも継続する。
    }

    startTransition(async () => {
      try {
        const result = await clockAction(mode, latitude, longitude);
        if (result.ok) {
          setMessage({
            text: `${mode === "IN" ? "出勤" : "退勤"}を記録しました${result.storeName ? ` (${result.storeName})` : ""}`,
            ok: true,
            warning: result.warning ?? undefined,
          });
          router.refresh();
        } else {
          setMessage({ text: result.error, ok: false });
        }
      } catch {
        setMessage({ text: "通信エラーが発生しました。もう一度お試しください。", ok: false });
      } finally {
        setBusy(false);
      }
    });
  }

  const isBusy = pending || busy;


  const label = mode === "IN" ? "出勤する" : "退勤する";
  const Icon = mode === "IN" ? LogIn : LogOut;
  const gradient = mode === "IN"
    ? "from-[#d72d2d] via-[#c51f26] to-[#9f1720]"
    : "from-[#34465a] via-[#26384b] to-[#1a2938]";

  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={isBusy}
        onClick={handleClock}
        className={`relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[16px] border border-white/15 bg-gradient-to-b ${gradient} px-4 py-3 text-[16px] font-black text-white shadow-[0_4px_0_rgba(0,0,0,.25)] transition active:translate-y-1 active:shadow-none disabled:opacity-60`}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/16 to-transparent" />
        <Icon size={27} className="relative" />
        <span className="relative">{isBusy ? "記録中..." : label}</span>
      </button>

      {message && (
        <div className="rounded-lg bg-white/90 px-2.5 py-1 text-center shadow-sm backdrop-blur-sm">
          <p className={`text-[11px] font-semibold ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
          {message.warning && <p className="text-[11px] font-semibold text-red-600">{message.warning}</p>}
        </div>
      )}
    </div>
  );
}
