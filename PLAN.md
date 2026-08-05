# Implementation plan

Ordered for a working demo early, then invariant hardness, then telemetry. Architecture rationale lives in `DECISIONS.md`.

## Prerequisites

- Node 20+
- Docker (Postgres)
- OS: Linux

Data files: `data/seed.json`, `data/feed.jsonl` (restored from assignment materials; tracked under `data/`).

## Target commands (README will match)

```bash
npm run setup   # install, docker postgres up, migrate, seed, ingest feed
npm run dev     # Next.js on :3000
```

## Phase 0 — Scaffold

- Next.js App Router + TypeScript + Tailwind
- Prisma + Postgres via `docker-compose.yml`
- `npm run setup` script chaining install → db → migrate → seed → ingest
- App shell: `/` driver marketplace, `/ops` fleet, `/ops/disputes` (Part 2)

## Phase 1 — Schema (marketplace)

Prisma models: Dealer, Plan, Vehicle, Driver, Subscription, DomainEvent, LedgerEntry, DataConflict.

Critical migration detail: **partial unique index**

```sql
CREATE UNIQUE INDEX subscriptions_one_live_per_vehicle
ON subscriptions (vehicle_id)
WHERE status IN ('RESERVED', 'ACTIVE', 'ENDING');
```

Also: subscription status enum includes `CONFLICTING` for quarantined seed rows.

## Phase 2 — Seed loader

- Insert dealers, plans, vehicles, drivers, subscriptions, domain events as-is
- Detection pass:
  - multiple live subs per vehicle → quarantine all but earliest `startDate`
  - vehicle.status vs live sub mismatch → `data_conflicts`
  - plan.basePrice vs subscription.monthlyPrice mismatch → flag (do not rewrite price)
  - odometer impossibilities (e.g. sub startOdometer > vehicle.odometer) → flag
- Every conflict visible on `/ops/conflicts`

## Phase 3 — Marketplace + ops UI (Part 1)

- Driver: list bookable vehicles (no live commitment, not `PENDING_INTAKE`), plan picker, commit
- Commit API: transaction + `FOR UPDATE` + unique index; loser gets `409 VEHICLE_NOT_AVAILABLE`
- Ops: fleet table (vehicle, derived state, live sub, conflict badges)
- Mid-flight: early end on a live sub → ledger entries with explanations
- Concurrent commit demo script: `npm run test:invariant`

## Phase 4 — Telemetry schema + ingest (Part 2)

Models: Device, DeviceVehicleAssignment, TelemetryRaw, Trip, MileageDecision.

- Ingest `data/feed.jsonl` idempotently
- Handle `vinChange`, disconnect/connect, duplicates, out-of-order, REST `trip`
- Assemble trips; compute mileage decisions with provenance
- `/ops/disputes?imei=&period=` — the morning email screen
- Tests: one per failure mode in `DECISIONS.md`

## Phase 5 — Docs finish

- `TELEMETRY_MEMO.md` (after living with the feed)
- `HOW-I-BUILT-IT.md` (rules, overrides, throwaways, hand-checks)
- Video outline (not the video itself)
- README: two commands + OS

## Out of order on purpose

Do **not** start with a polished design system or auth. Empty-screen risk is higher than aesthetic risk. Seed and ingest before styling polish.

## Done when

- [ ] Clean machine: `npm run setup && npm run dev` → clickable data on every screen
- [ ] Concurrent commit: one winner, one sensible 409
- [ ] Early end shows defendable ledger rows
- [ ] Ops shows what we decided about bad seed rows
- [ ] Dispute screen explains a dirty trip without inventing miles
- [ ] Tests cover each telemetry failure mode we claim
