// Client: ★ AI summary of the loaded IMEI activity (1–3 sentences via OpenAI).

"use client";

import { useState } from "react";

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!imei || loading) return;
    setLoading(true);
    setError(null);
    setSummary(null);
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
      const data = (await res.json()) as { summary?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setSummary(data.summary ?? null);
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
          {summary ? (
            <div className="max-w-2xl border border-rule px-4 py-3">
              <p className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
                AI activity summary
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink">{summary}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
