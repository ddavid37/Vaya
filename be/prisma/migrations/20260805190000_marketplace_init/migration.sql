-- Initial marketplace tables, enums, and one-live-sub partial unique index.

CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'SUBSCRIBED', 'RESERVED', 'PENDING_INTAKE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('RESERVED', 'ACTIVE', 'ENDING', 'ENDED', 'CONFLICTING');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('PERIOD_BASE', 'MILES_INCLUDED', 'MILES_USED', 'OVERAGE', 'PRORATION');

-- CreateEnum
CREATE TYPE "ConflictType" AS ENUM ('DUAL_LIVE_SUBSCRIPTION', 'VEHICLE_STATUS_MISMATCH', 'PRICE_MISMATCH', 'ODOMETER_IMPOSSIBILITY');

-- CreateTable
CREATE TABLE "dealers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "joined_at" DATE NOT NULL,

    CONSTRAINT "dealers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "monthly_miles" INTEGER NOT NULL,
    "overage_per_mile" DECIMAL(10,2) NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "odometer" INTEGER NOT NULL,
    "status" "VehicleStatus" NOT NULL,
    "monthly_price" DECIMAL(10,2),
    "listed_at" DATE NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "license_state" TEXT NOT NULL,
    "created_at" DATE NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "monthly_price" DECIMAL(10,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "billing_period_start" DATE,
    "billing_period_end" DATE,
    "start_odometer" INTEGER NOT NULL,
    "miles_this_period" INTEGER NOT NULL DEFAULT 0,
    "cancelled_at" TIMESTAMP(3),
    "previous_plan_id" TEXT,
    "previous_monthly_price" DECIMAL(10,2),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_events" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "quantity" DECIMAL(12,3),
    "unit" TEXT,
    "explanation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_conflicts" (
    "id" TEXT NOT NULL,
    "type" "ConflictType" NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_ids" TEXT[],
    "resolution" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_vin_key" ON "vehicles"("vin");

-- CreateIndex
CREATE INDEX "subscriptions_vehicle_id_status_idx" ON "subscriptions"("vehicle_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_driver_id_idx" ON "subscriptions"("driver_id");

-- CreateIndex
CREATE INDEX "domain_events_subject_type_subject_id_idx" ON "domain_events"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "domain_events_at_idx" ON "domain_events"("at");

-- CreateIndex
CREATE INDEX "ledger_entries_subscription_id_idx" ON "ledger_entries"("subscription_id");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- One live commitment per vehicle (RESERVED | ACTIVE | ENDING).
-- CONFLICTING / ENDED are excluded so quarantine and history can coexist.
CREATE UNIQUE INDEX subscriptions_one_live_per_vehicle
ON subscriptions (vehicle_id)
WHERE status IN ('RESERVED', 'ACTIVE', 'ENDING');
