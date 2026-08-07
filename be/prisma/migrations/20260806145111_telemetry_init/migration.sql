-- Part 2 telemetry tables and enums (devices, raw, assignments, trips, mileage decisions).

CREATE TYPE "TripAssemblyStatus" AS ENUM ('OPEN', 'COMPLETE', 'METRICS_DELAYED', 'IMPOSSIBLE_ODOMETER', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "MileageSource" AS ENUM ('ODOMETER_DELTA', 'TRIP_DISTANCE', 'NONE');

-- CreateTable
CREATE TABLE "devices" (
    "imei" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("imei")
);

-- CreateTable
CREATE TABLE "device_vehicle_assignments" (
    "id" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "opened_by" TEXT,
    "closed_by" TEXT,

    CONSTRAINT "device_vehicle_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry_raw" (
    "id" TEXT NOT NULL,
    "natural_key" TEXT NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "imei" TEXT,
    "transaction_id" TEXT,
    "event_at" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_raw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "vin" TEXT,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "start_odometer" DECIMAL(12,3),
    "end_odometer" DECIMAL(12,3),
    "trip_distance" DECIMAL(12,3),
    "assembly_status" "TripAssemblyStatus" NOT NULL,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mileage_decisions" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "trusted_miles" DECIMAL(12,3),
    "source" "MileageSource" NOT NULL,
    "discarded_inputs" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mileage_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_vehicle_assignments_imei_started_at_idx" ON "device_vehicle_assignments"("imei", "started_at");

-- CreateIndex
CREATE INDEX "device_vehicle_assignments_vin_started_at_idx" ON "device_vehicle_assignments"("vin", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "telemetry_raw_natural_key_key" ON "telemetry_raw"("natural_key");

-- CreateIndex
CREATE INDEX "telemetry_raw_imei_delivered_at_idx" ON "telemetry_raw"("imei", "delivered_at");

-- CreateIndex
CREATE INDEX "telemetry_raw_transaction_id_idx" ON "telemetry_raw"("transaction_id");

-- CreateIndex
CREATE INDEX "telemetry_raw_event_delivered_at_idx" ON "telemetry_raw"("event", "delivered_at");

-- CreateIndex
CREATE UNIQUE INDEX "trips_transaction_id_key" ON "trips"("transaction_id");

-- CreateIndex
CREATE INDEX "trips_imei_start_at_idx" ON "trips"("imei", "start_at");

-- CreateIndex
CREATE INDEX "trips_vin_start_at_idx" ON "trips"("vin", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "mileage_decisions_trip_id_key" ON "mileage_decisions"("trip_id");

-- AddForeignKey
ALTER TABLE "device_vehicle_assignments" ADD CONSTRAINT "device_vehicle_assignments_imei_fkey" FOREIGN KEY ("imei") REFERENCES "devices"("imei") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_raw" ADD CONSTRAINT "telemetry_raw_imei_fkey" FOREIGN KEY ("imei") REFERENCES "devices"("imei") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_imei_fkey" FOREIGN KEY ("imei") REFERENCES "devices"("imei") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mileage_decisions" ADD CONSTRAINT "mileage_decisions_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
