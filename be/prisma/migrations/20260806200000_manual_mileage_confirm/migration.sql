-- Manual (handwritten-style) mileage confirmation for overage disputes.
CREATE TABLE "manual_mileage_confirms" (
    "id" TEXT NOT NULL,
    "imei" TEXT,
    "vin" TEXT NOT NULL,
    "representor_name" TEXT NOT NULL,
    "mileage_recorded" DECIMAL(12,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_mileage_confirms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "manual_mileage_confirms_vin_created_at_idx" ON "manual_mileage_confirms"("vin", "created_at");
CREATE INDEX "manual_mileage_confirms_imei_created_at_idx" ON "manual_mileage_confirms"("imei", "created_at");
