<!-- Living log of every DB schema/data manipulation we make. -->

# DB manipulations & decisions

Living log of every database change we make (migrations, seed transforms, manual fixes, quarantines).  
If it touches Postgres/Supabase data or schema, it goes here.

---

## 2026-08-05 — Marketplace schema migrate

**Action:** Applied Prisma migration `20260805190000_marketplace_init` to Supabase.

**Tables created:** `dealers`, `plans`, `vehicles`, `drivers`, `subscriptions`, `domain_events`, `ledger_entries`, `data_conflicts`.

**Index:** `subscriptions_one_live_per_vehicle` — unique on `vehicle_id` where `status IN ('RESERVED','ACTIVE','ENDING')`.

**Why:** Enforce one live commitment per vehicle at the database layer (see `DECISIONS.md`).

**Files:** `be/prisma/schema.prisma`, `be/prisma/migrations/20260805190000_marketplace_init/migration.sql`.

---

## 2026-08-05 — Seed load (`npm run db:seed`)

**Action:** Loaded `be/data/seed.json` into Supabase via `be/scripts/seed.ts`.

**Counts:** 3 dealers, 6 plans, 40 vehicles, 25 drivers, 26 subscriptions, 44 domain events.

### Quarantine: dual live subscription on `veh-004`

| | |
|---|---|
| **Whose fault?** | **Seed fixture**, not our app and not Supabase. The assignment file ships two `ACTIVE` subscriptions on one vehicle. |
| **Rows** | `sub-004` (driver `drv-004`, start `2026-02-12`) and `sub-026` (driver `drv-020`, start `2026-07-02`) both claimed `veh-004`. |
| **What we did** | Kept both rows. Set `sub-026.status = CONFLICTING`. Left `sub-004` as `ACTIVE`. |
| **Rule** | Earliest `startDate` wins (tie-break: `id` asc). |
| **Why before insert** | The partial unique index rejects two live rows; quarantine must happen at load time or the seed cannot apply. |
| **Audit** | Inserted `data_conflicts` row type `DUAL_LIVE_SUBSCRIPTION`, subjects `[sub-004, sub-026]`. |
| **How often?** | Once in this dataset. |

### Other conflict flags (no row rewrites)

Also wrote `data_conflicts` for:

- `VEHICLE_STATUS_MISMATCH` — `vehicles.status` vs live subscription set
- `PRICE_MISMATCH` — `plans.base_price` ≠ `subscriptions.monthly_price`
- `ODOMETER_IMPOSSIBILITY` — `start_odometer` > vehicle odometer

Source prices/statuses/odometers were **not** rewritten (except the dual-live status override above).

**Total conflict rows after seed:** 21 (including 1 dual-live).

**Re-run:** `npm run db:seed` (destructive reload of marketplace tables).

---

## 2026-08-05 — Google sign-in drivers (runtime)

**Action:** No migration. On first Google login, Auth.js upserts a `drivers` row (`id = drv-<hash of email>`, email/name from Google, `license_state = XX`).

**Why:** Marketplace commits need a real session driver so two Gmail accounts can race the same car (see `DECISIONS.md` / `HOW-I-BUILT-IT.md`).

**Note:** Seed emails are untouched. Lookup is case-insensitive by email; if a Google email somehow matched a seed driver, that row would be reused (unlikely with real Gmails).

**Reversible?** Delete the `drv-…` rows created by login; re-login recreates them.

---

## 2026-08-06 — Telemetry schema migrate (Part 2)

**Action:** Applied Prisma migration `20260806145111_telemetry_init` to Supabase.

**Tables created:** `devices`, `device_vehicle_assignments`, `telemetry_raw`, `trips`, `mileage_decisions`.

**Enums added:** `TripAssemblyStatus`, `MileageSource`.

**Why:** Part 2 device-keyed telemetry, separate from marketplace. No FK from trips/assignments into `vehicles` — feed VINs do not appear in seed (parallel dataset; see `DECISIONS.md`).

**Design notes:**
- `devices.imei` is the identity.
- `telemetry_raw.natural_key` unique for idempotent ingest.
- `trips.transaction_id` unique; assembly status + flags for delayed/impossible cases.
- `mileage_decisions` stores trusted miles + provenance (never silent average).

**Marketplace tables:** untouched.

**Reversible?** `prisma migrate` rollback / drop those five tables + two enums (not done routinely).

---

## 2026-08-06 — Telemetry feed ingest (`npm run db:ingest`)

**Action:** Loaded `be/data/feed.jsonl` via `be/scripts/ingest.ts`.

**What we did:**
- Truncated telemetry tables only (`mileage_decisions`, `trips`, `telemetry_raw`, `device_vehicle_assignments`, `devices`) — marketplace untouched.
- Inserted each JSONL line into `telemetry_raw` with deterministic `natural_key` (idempotent).
- Ensured `devices` rows by IMEI.
- Opened/rotated `device_vehicle_assignments` when an event carries a VIN; on `vinChange`, closed the open interval and opened one for `newVin`.

**Why:** Append-only raw store + time-bounded IMEI↔VIN bindings before trip assembly (see `DECISIONS.md`). Feed VINs stay unlinked from seed vehicles.

**Re-run:** `npm run db:ingest` (destructive reload of telemetry tables).

---

## 2026-08-06 — Trip assembly + mileage decisions (`npm run db:assemble`)

**Action:** Built `trips` + `mileage_decisions` from `telemetry_raw` via `be/scripts/assemble.ts`.

**Rules:**
- Group by `transactionId` (tripStart/End/Metrics + REST `trip`).
- Prefer event timestamps; last deliveredAt wins for duplicate end/metrics.
- VIN from fragments or active assignment at `startAt`.
- Mileage: prefer monotonic odometer delta; else `tripDistance`; never average. Impossible odo (e.g. TX-480041) → discard delta, trust distance when present.
- Flags: `duplicate_trip_end`, `revised_metrics`, `metrics_delayed`, `rest_trip`, `vin_from_assignment`, `impossible_odometer`.

**UI:** `/ops/disputes?imei=&from=&to=` — trusted miles + rationale per trip.

**Re-run:** `npm run db:assemble` after ingest (wipes trips/mileage_decisions only).

---

## 2026-08-06 — Manual mileage confirms (handover evidence)

**Action:** Added `manual_mileage_confirms` (`ManualMileageConfirm`) for ops handwritten-style overage evidence: representor name, mileage recorded, VIN (optional IMEI).

**Why:** Address “only evidence was our own handwriting” with a logged confirmation next to feed-derived trusted miles. Vehicle scan before/after and client policy insurance stay UI placeholders (not persisted).

**UI:** `/ops/disputes` handover sections; `/ops/signals` for avg speed / acceleration score sketch.

**Reversible?** Drop table via migration rollback.

---

## Template for future entries

```md
## YYYY-MM-DD — short title

**Action:** what ran / who changed what
**Why:** decision rationale
**Before → After:** concrete row/schema delta
**Reversible?** how / command
```
