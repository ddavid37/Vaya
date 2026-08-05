"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function defaultEndDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function ManageSubscription({
  subscriptionId,
  status,
  currentEndDate,
}: {
  subscriptionId: string;
  status: string;
  currentEndDate?: string | null;
}) {
  const router = useRouter();
  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [endDate, setEndDate] = useState(
    currentEndDate && currentEndDate > minDate ? currentEndDate : defaultEndDate(),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (status === "ENDED") {
    return (
      <p className="font-mono text-[0.65rem] tracking-[0.12em] text-muted uppercase">
        Ended — see ledger below
      </p>
    );
  }

  async function run(mode: "SCHEDULE" | "IMMEDIATE") {
    setPending(true);
    setMessage(null);
    try {
      const body: { mode: typeof mode; endDate?: string } = { mode };
      if (mode === "SCHEDULE") {
        if (!endDate || endDate < minDate) {
          setMessage("Pick an end date on or after today");
          return;
        }
        body.endDate = endDate;
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
    <div className="flex flex-col gap-3 border border-rule bg-white p-4">
      <p className="font-mono text-[0.65rem] tracking-[0.16em] text-orange uppercase">
        Manage subscription
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
          Scheduled end date
        </span>
        <input
          type="date"
          min={minDate}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border border-rule-s bg-white px-2 py-1.5 font-mono text-sm text-ink outline-none focus:border-orange"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("SCHEDULE")}
          className="border border-rule-s px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-mid uppercase transition-colors hover:border-orange hover:text-orange disabled:opacity-50"
        >
          Schedule end
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("IMMEDIATE")}
          className="bg-orange px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-white uppercase transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          End now
        </button>
      </div>
      {message ? (
        <span className="font-mono text-[0.7rem] text-mid">{message}</span>
      ) : null}
    </div>
  );
}
