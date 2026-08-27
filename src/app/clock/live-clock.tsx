"use client";

import { useEffect, useState } from "react";

export function LiveClock() {
  // Starts null and fills in on mount so the server-rendered HTML and the
  // client's first render match (avoids a hydration mismatch from a
  // time-dependent value computed at request time).
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const intervalId = setInterval(tick, 1000);
    // Deferred (not called synchronously in the effect body) so the first
    // paint after mount also shows the current time immediately.
    const timeoutId = setTimeout(tick, 0);
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, []);

  if (!now) {
    return <div className="h-[52px]" />;
  }

  const dateLabel = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);
  const timeLabel = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);

  return (
    <div className="text-center">
      <p className="text-sm font-medium text-slate-600">{dateLabel}</p>
      <p className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text font-mono text-4xl font-bold tracking-wide text-transparent tabular-nums">
        {timeLabel}
      </p>
    </div>
  );
}
