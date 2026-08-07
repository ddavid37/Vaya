// Placeholder before/after vehicle condition scans (damage timing) — Part 2 Signals.

"use client";

import { useState } from "react";

export function VehicleScanning() {
  const [scanBefore, setScanBefore] = useState("Pending — placeholder");
  const [scanAfter, setScanAfter] = useState("Pending — placeholder");

  return (
    <section className="mt-10 border border-rule p-5">
      <p className="font-mono text-[0.65rem] tracking-[0.16em] text-mid uppercase">
        Vehicle scanning
      </p>
      <p className="mt-2 max-w-2xl text-[0.8rem] leading-relaxed font-light text-muted">
        Placeholder for before/after condition scans (when damage happened). Not
        wired to a camera pipeline yet.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
            Scan before
          </span>
          <input
            value={scanBefore}
            onChange={(e) => setScanBefore(e.target.value)}
            className="border border-rule-s px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
          />
          <button
            type="button"
            onClick={() =>
              setScanBefore(
                `Captured placeholder @ ${new Date().toISOString().slice(0, 16)}Z`,
              )
            }
            className="mt-1 w-fit border border-rule-s px-2 py-1 font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase hover:border-orange hover:text-orange"
          >
            Mark before scan
          </button>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
            Scan after
          </span>
          <input
            value={scanAfter}
            onChange={(e) => setScanAfter(e.target.value)}
            className="border border-rule-s px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
          />
          <button
            type="button"
            onClick={() =>
              setScanAfter(
                `Captured placeholder @ ${new Date().toISOString().slice(0, 16)}Z`,
              )
            }
            className="mt-1 w-fit border border-rule-s px-2 py-1 font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase hover:border-orange hover:text-orange"
          >
            Mark after scan
          </button>
        </label>
      </div>
    </section>
  );
}
