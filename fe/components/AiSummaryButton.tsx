// Client: ★ AI summary of the loaded IMEI activity (1–3 sentences via OpenAI).

"use client";

import { useState } from "react";
import { type UsageLevel } from "@/lib/usage-level";

const USAGE_LEGEND: Array<{
  level: UsageLevel;
  label: string;
  circle: string;
}> = [
  { level: "green", label: "Healthy overall", circle: "usage-dot-green" },
  { level: "yellow", label: "Fair overall", circle: "usage-dot-yellow" },
  { level: "orange", label: "Poor / caution", circle: "usage-dot-orange" },
  { level: "red", label: "Severe overall", circle: "usage-dot-red" },
];

const BOX: Record<UsageLevel, string> = {
  green: "usage-box-green",
  yellow: "usage-box-yellow",
  orange: "usage-box-orange",
  red: "usage-box-red",
};

export function AiSummaryButton({
  imei,
  from,
  to,
}: {
  imei: string;
  from?: string;
  to?: string;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [level, setLevel] = useState<UsageLevel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!imei || loading) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    setLevel(null);
    try {
      const res = await fetch("/api/ops/disputes/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imei,
          from: from || undefined,
          to: to || undefined,
        }),
      });
      const data = (await res.json()) as {
        summary?: string;
        level?: UsageLevel;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setSummary(data.summary ?? null);
      setLevel(data.level ?? null);
    } catch {
      setError("Could not reach summary API");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={!imei || loading}
        className="border border-orange bg-white px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-orange uppercase transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "★ AI…" : "★ AI"}
      </button>
      {error || summary ? (
        <div className="basis-full w-full">
          {error ? <p className="text-sm text-orange">{error}</p> : null}
          {summary && level ? (
            <div className="flex w-full flex-col gap-4 md:flex-row md:items-start md:gap-8">
              <div
                className={`min-w-0 flex-1 border px-4 py-3 ${BOX[level]}`}
              >
                <p className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
                  AI activity summary
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink">
                  {summary}
                </p>
              </div>
              <aside className="shrink-0 md:w-48">
                <p className="mb-2 font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
                  Usage legend
                </p>
                <ul className="flex flex-col gap-2">
                  {USAGE_LEGEND.map((row) => (
                    <li
                      key={row.level}
                      className="flex items-center gap-2 font-mono text-[0.7rem] text-ink"
                    >
                      <span
                        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${row.circle}`}
                        aria-hidden
                      />
                      <span>{row.label}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
