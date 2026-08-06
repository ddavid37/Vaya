"use server";

// Persist a manual (handwritten-style) mileage confirmation for overage disputes.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function saveManualMileageConfirm(formData: FormData) {
  const representorName = String(formData.get("representorName") ?? "").trim();
  const vin = String(formData.get("vin") ?? "").trim();
  const imei = String(formData.get("imei") ?? "").trim() || null;
  const mileageRaw = String(formData.get("mileageRecorded") ?? "").trim();
  const mileageRecorded = Number(mileageRaw);

  if (!representorName || !vin || !Number.isFinite(mileageRecorded)) {
    return;
  }

  await db.manualMileageConfirm.create({
    data: {
      representorName,
      vin,
      imei,
      mileageRecorded,
    },
  });

  revalidatePath("/ops/disputes");
}
