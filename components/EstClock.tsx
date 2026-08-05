"use client";

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
    second: "2-digit",
    hour12: true,
  }).format(now);
  return { date, time };
}

export function EstClock() {
  const [label, setLabel] = useState<{ date: string; time: string } | null>(
    null,
  );

  useEffect(() => {
    const tick = () => setLabel(formatEst(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!label) {
    return (
      <p className="font-mono text-[0.55rem] tracking-[0.08em] text-muted uppercase">
        …
      </p>
    );
  }

  return (
    <p className="text-right font-mono text-[0.55rem] leading-snug tracking-[0.06em] text-muted uppercase">
      <span className="block">{label.date}</span>
      <span className="block normal-case tracking-normal">
        {label.time} EST
      </span>
    </p>
  );
}
