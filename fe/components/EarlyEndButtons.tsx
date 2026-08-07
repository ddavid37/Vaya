"use client";

// Ops client controls: schedule (+7d) or immediate early-end for a subscription.

import { useRouter } from "next/navigation";
import { useState } from "react";

export function EarlyEndButtons({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(mode: "SCHEDULE" | "IMMEDIATE") {
    setPending(true);
    setMessage(null);
    try {
      const body: { mode: typeof mode; endDate?: string } = { mode };
      if (mode === "SCHEDULE") {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 7);
        body.endDate = d.toISOString().slice(0, 10);
      }
      const res = await fetch(`/api/subscriptions/${subscriptionId}/early-end`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ledgerLines?: number;
        code?: string;
        message?: string;
      };
      if (!res.ok) {
        setMessage(`${data.code ?? res.status}: ${data.message ?? "failed"}`);
        return;
      }
      setMessage(`${mode}: ${data.ledgerLines} ledger lines`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("SCHEDULE")}
          className="border border-rule-s px-2 py-1 font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase transition-colors hover:border-orange hover:text-orange disabled:opacity-50"
        >
          Schedule end
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("IMMEDIATE")}
          className="bg-orange px-2 py-1 font-mono text-[0.6rem] tracking-[0.12em] text-white uppercase transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          End now
        </button>
      </div>
      {message ? (
        <span className="font-mono text-[0.65rem] text-mid">{message}</span>
      ) : null}
    </div>
  );
}
