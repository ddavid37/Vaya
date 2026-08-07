// Manual mileage confirm + multi client policy insurance (optional per-driver) — top of Mileage review.

"use client";

import { useState } from "react";
import { saveManualMileageConfirm } from "@/app/ops/disputes/actions";

type ConfirmRow = {
  id: string;
  representorName: string;
  vin: string;
  mileageRecorded: string;
  createdAt: string;
};

type PolicyDraft = {
  id: string;
  carrier: string;
  policyRef: string;
  forSpecificDriver: boolean;
  driverName: string;
  saved: boolean;
};

function newPolicy(): PolicyDraft {
  return {
    id: crypto.randomUUID(),
    carrier: "",
    policyRef: "",
    forSpecificDriver: false,
    driverName: "",
    saved: false,
  };
}

export function HandoverEvidence({
  imei,
  defaultVin,
  confirms,
}: {
  imei: string;
  defaultVin: string;
  confirms: ConfirmRow[];
}) {
  const [policies, setPolicies] = useState<PolicyDraft[]>([newPolicy()]);

  function updatePolicy(id: string, patch: Partial<PolicyDraft>) {
    setPolicies((rows) =>
      rows.map((p) => (p.id === id ? { ...p, ...patch, saved: false } : p)),
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <section className="border border-rule p-5">
        <p className="font-mono text-[0.65rem] tracking-[0.16em] text-mid uppercase">
          Manual mileage confirmation
        </p>
        <p className="mt-2 max-w-2xl text-[0.8rem] leading-relaxed font-light text-muted">
          Replaces “two handwritten odometer readings months apart” with a
          logged ops confirmation (representor, recorded mileage, VIN).
        </p>
        <form
          action={saveManualMileageConfirm}
          className="mt-4 flex flex-wrap items-end gap-4"
        >
          <input type="hidden" name="imei" value={imei} />
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
              Representor name
            </span>
            <input
              name="representorName"
              required
              className="min-w-[12rem] border border-rule-s px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
              placeholder="Ops / dealer name"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
              Mileage recorded
            </span>
            <input
              name="mileageRecorded"
              type="number"
              step="0.1"
              required
              className="w-[10rem] border border-rule-s px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
              placeholder="e.g. 22840.0"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
              Car VIN
            </span>
            <input
              name="vin"
              required
              defaultValue={defaultVin}
              className="min-w-[16rem] border border-rule-s px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
            />
          </label>
          <button
            type="submit"
            className="bg-orange px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-white uppercase hover:opacity-80"
          >
            Confirm
          </button>
        </form>
        {confirms.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2 border-t border-rule pt-3">
            {confirms.map((c) => (
              <li key={c.id} className="font-mono text-[0.7rem] text-mid">
                {c.createdAt} · {c.representorName} · {c.mileageRecorded} mi ·{" "}
                {c.vin}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 font-mono text-[0.7rem] text-muted">
            No manual confirms yet for this device.
          </p>
        )}
      </section>

      <section className="border border-rule p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[0.65rem] tracking-[0.16em] text-mid uppercase">
              Client policy insurance
            </p>
            <p className="mt-2 max-w-2xl text-[0.8rem] leading-relaxed font-light text-muted">
              Placeholder policies for the car and/or a named driver. Not priced
              from telemetry yet.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPolicies((rows) => [...rows, newPolicy()])}
            className="border border-orange px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-orange uppercase hover:opacity-80"
            aria-label="Add another client policy insurance"
          >
            + Add policy
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {policies.map((p, i) => (
            <div
              key={p.id}
              className="border border-rule-s bg-white px-4 py-4"
            >
              <p className="mb-3 font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
                Policy {i + 1}
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
                    Policy / carrier
                  </span>
                  <input
                    value={p.carrier}
                    onChange={(e) =>
                      updatePolicy(p.id, { carrier: e.target.value })
                    }
                    className="min-w-[12rem] border border-rule-s px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
                    placeholder="e.g. Fleet Mutual"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
                    Policy ref
                  </span>
                  <input
                    value={p.policyRef}
                    onChange={(e) =>
                      updatePolicy(p.id, { policyRef: e.target.value })
                    }
                    className="min-w-[12rem] border border-rule-s px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
                    placeholder="POL-…"
                  />
                </label>
                <label className="flex items-center gap-2 pb-2 font-mono text-[0.7rem] text-mid">
                  <input
                    type="checkbox"
                    checked={p.forSpecificDriver}
                    onChange={(e) =>
                      updatePolicy(p.id, {
                        forSpecificDriver: e.target.checked,
                        driverName: e.target.checked ? p.driverName : "",
                      })
                    }
                  />
                  Specific driver
                </label>
                {p.forSpecificDriver ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
                      Driver name
                    </span>
                    <input
                      value={p.driverName}
                      onChange={(e) =>
                        updatePolicy(p.id, { driverName: e.target.value })
                      }
                      className="min-w-[12rem] border border-rule-s px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
                      placeholder="Named insured driver"
                    />
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    setPolicies((rows) =>
                      rows.map((row) =>
                        row.id === p.id ? { ...row, saved: true } : row,
                      ),
                    )
                  }
                  className="border border-orange px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-orange uppercase hover:opacity-80"
                >
                  Save placeholder
                </button>
                {policies.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPolicies((rows) => rows.filter((row) => row.id !== p.id))
                    }
                    className="border border-rule-s px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-mid uppercase hover:border-orange hover:text-orange"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              {p.saved ? (
                <p className="mt-3 font-mono text-[0.7rem] text-green-700">
                  Saved locally (demo): {p.carrier || "—"} / {p.policyRef || "—"}
                  {p.forSpecificDriver
                    ? ` · driver ${p.driverName || "unnamed"}`
                    : " · vehicle-level"}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
