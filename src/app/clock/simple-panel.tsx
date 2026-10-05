"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clockAction } from "./actions";
import { cancelSimpleAttendance, recordSimpleAttendance } from "./simple-actions";

type Kind = "ABSENT" | "LATE" | "EARLY_LEAVE";
export const KIND_LABEL: Record<Kind, string> = { ABSENT: "欠勤", LATE: "遅刻", EARLY_LEAVE: "早退" };

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    let done = false;
    const finish = (v: GeolocationPosition | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const t = setTimeout(() => finish(null), 12000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); finish(p); },
      () => { clearTimeout(t); finish(null); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export function SimplePanel({
  entries,
}: {
  entries: { id: string; kind: Kind }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const isBusy = pending || busy;

  async function punch(type: "IN" | "OUT") {
    if (isBusy) return;
    setBusy(true);
    setMessage(null);
    let latitude: number | null = null;
    let longitude: number | null = null;
    try {
      const pos = await getPosition();
      latitude = pos?.coords.latitude ?? null;
      longitude = pos?.coords.longitude ?? null;
    } catch {
      // 位置情報なしでも打刻は続ける。
    }
    startTransition(async () => {
      try {
        const r = await clockAction(type, latitude, longitude);
        setMessage(r.ok ? { text: `${type === "IN" ? "出勤" : "退勤"}を記録しました`, ok: true } : { text: r.error, ok: false });
        if (r.ok) router.refresh();
      } catch {
        setMessage({ text: "通信エラーが発生しました。もう一度お試しください。", ok: false });
      } finally {
        setBusy(false);
      }
    });
  }

  function note(kind: Kind) {
    if (isBusy) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const r = await recordSimpleAttendance(kind);
        setMessage(r.ok ? { text: `${KIND_LABEL[kind]}を記録しました`, ok: true } : { text: r.error, ok: false });
        if (r.ok) router.refresh();
      } catch {
        setMessage({ text: "通信エラーが発生しました。もう一度お試しください。", ok: false });
      }
    });
  }

  function cancel(id: string) {
    if (isBusy) return;
    startTransition(async () => {
      const r = await cancelSimpleAttendance(id);
      setMessage(r.ok ? { text: "取り消しました", ok: true } : { text: r.error, ok: false });
      if (r.ok) router.refresh();
    });
  }

  const big = "w-full rounded-2xl px-4 py-6 text-xl font-black text-white shadow-[0_4px_0_rgba(0,0,0,.25)] transition active:translate-y-1 active:shadow-none disabled:opacity-60";
  const small = "rounded-xl border-2 px-2 py-4 text-base font-black transition active:translate-y-0.5 disabled:opacity-60";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={isBusy} onClick={() => punch("IN")} className={`${big} bg-[#c51f26]`}>出勤</button>
        <button type="button" disabled={isBusy} onClick={() => punch("OUT")} className={`${big} bg-[#26384b]`}>退勤</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["ABSENT", "LATE", "EARLY_LEAVE"] as Kind[]).map((k) => (
          <button key={k} type="button" disabled={isBusy} onClick={() => note(k)} className={`${small} border-slate-300 bg-white text-slate-800`}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {message && (
        <p className={`rounded-lg bg-white px-3 py-2 text-center text-sm font-bold shadow-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
      {entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-slate-600">本日の記録:</span>
          {entries.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-black text-amber-800">
              {KIND_LABEL[e.kind]}
              <button type="button" disabled={isBusy} onClick={() => cancel(e.id)} className="ml-1 text-xs font-bold text-amber-700 underline">取消</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
