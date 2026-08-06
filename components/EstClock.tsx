"use client";

// Client live date/time in America/New_York under the auth controls.

import { useEffect, useState } from "react";

function formatEst(now: Date) {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
  return `${date} · ${time} EST`;
}

export function EstClock() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setLabel(formatEst(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="max-w-full whitespace-nowrap font-mono text-[0.55rem] tracking-[0.06em] text-muted uppercase">
      {label ?? "…"}
    </p>
  );
}
