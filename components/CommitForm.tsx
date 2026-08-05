"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Plan = { id: string; name: string; tier: string; basePrice: string };

export function CommitForm({
  vehicleId,
  plans,
}: {
  vehicleId: string;
  plans: Plan[];
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onCommit() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vehicleId, planId }),
      });
      const data = (await res.json()) as {
        id?: string;
        code?: string;
        message?: string;
      };
      if (!res.ok) {
        setMessage(`${data.code ?? res.status}: ${data.message ?? "failed"}`);
        return;
      }
      setMessage(`Committed ${data.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <select
        className="border border-rule-s bg-white px-2 py-1.5 text-sm text-ink outline-none focus:border-orange"
        value={planId}
        onChange={(e) => setPlanId(e.target.value)}
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} {p.tier} · ${p.basePrice}/mo
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending || !planId}
        onClick={onCommit}
        className="bg-orange px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-white uppercase transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {pending ? "Committing…" : "Commit"}
      </button>
      {message ? (
        <span className="font-mono text-[0.7rem] text-mid">{message}</span>
      ) : null}
    </div>
  );
}
