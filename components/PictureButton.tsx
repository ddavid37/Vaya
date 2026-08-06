"use client";

// Marketplace Picture button that opens a small unavailable-photo dialog.

import { useEffect, useRef } from "react";
import { useState } from "react";

export function PictureButton({ vehicleLabel }: { vehicleLabel: string }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-orange px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-white uppercase transition-opacity hover:opacity-80"
      >
        Picture
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-auto max-w-sm border border-rule bg-white p-0 text-ink shadow-lg backdrop:bg-ink/40"
      >
        <div className="px-5 py-4">
          <p className="font-mono text-[0.65rem] tracking-[0.16em] text-orange uppercase">
            Picture
          </p>
          <p className="mt-3 text-sm leading-relaxed text-mid">
            Sorry — the picture of this specific car ({vehicleLabel}) is not
            available.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-4 bg-orange px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-white uppercase transition-opacity hover:opacity-80"
          >
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
