// Manual mileage confirm + client policy insurance placeholders (Mileage review).

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

export function HandoverEvidence({
  imei,
  defaultVin,
  confirms,
}: {
  imei: string;
  defaultVin: string;
  confirms: ConfirmRow[];
}) {
  const [policyRef, setPolicyRef] = useState("");
  const [policyCarrier, setPolicyCarrier] = useState("");
  const [policySaved, setPolicySaved] = useState(false);

  return (
    <div className="mt-10 flex flex-col gap-8">
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
        <p className="font-mono text-[0.65rem] tracking-[0.16em] text-mid uppercase">
          Client policy insurance
        </p>
        <p className="mt-2 max-w-2xl text-[0.8rem] leading-relaxed font-light text-muted">
          Placeholder link to the subscriber’s insurance / fleet policy context
          (not priced from telemetry yet).
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
              Policy / carrier
            </span>
            <input
              value={policyCarrier}
              onChange={(e) => {
                setPolicyCarrier(e.target.value);
                setPolicySaved(false);
              }}
              className="min-w-[12rem] border border-rule-s px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
              placeholder="e.g. Fleet Mutual"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.6rem] tracking-[0.12em] text-mid uppercase">
              Policy ref
            </span>
            <input
              value={policyRef}
              onChange={(e) => {
                setPolicyRef(e.target.value);
                setPolicySaved(false);
              }}
              className="min-w-[12rem] border border-rule-s px-2 py-1.5 font-mono text-sm outline-none focus:border-orange"
              placeholder="POL-…"
            />
          </label>
          <button
            type="button"
            onClick={() => setPolicySaved(true)}
            className="border border-orange px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-orange uppercase hover:opacity-80"
          >
            Save placeholder
          </button>
        </div>
        {policySaved ? (
          <p className="mt-3 font-mono text-[0.7rem] text-green-700">
            Saved locally (demo): {policyCarrier || "—"} / {policyRef || "—"}
          </p>
        ) : null}
      </section>
    </div>
  );
}
