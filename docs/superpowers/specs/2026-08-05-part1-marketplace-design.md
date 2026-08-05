# Part 1 Marketplace — Design

**Status:** Approved for build (user chose execute `DECISIONS.md` + `PLAN.md` as written).  
**Date:** 2026-08-05  
**Branch:** `cursor/build`

Architecture rationale and forks live in [`DECISIONS.md`](../../../DECISIONS.md). Ordered phases live in [`PLAN.md`](../../../PLAN.md). This doc scopes **Part 1 only**.

---

## Goal

A clickable car-subscription marketplace and ops console on seeded data that proves: one vehicle cannot hold two live commitments at once, even under concurrent commits; mid-flight early end produces defendable ledger rows; bad seed rows are quarantined, not silently cleaned.

## In scope

| Area | Behavior |
|---|---|
| Driver marketplace (`/`) | List bookable vehicles; plan picker; commit subscription |
| Commit API | Transaction + `SELECT … FOR UPDATE` on vehicle + partial unique index; loser → `409` with `code: VEHICLE_NOT_AVAILABLE` |
| Mid-flight | Early end: schedule → `ENDING`, then `ENDED`; write ledger entries with human-readable `explanation` |
| Ops (`/ops`) | Fleet table: vehicle, derived live state, live sub, conflict badges |
| Ops conflicts (`/ops/conflicts`) | List `data_conflicts` from seed load |
| Seed load | Insert `data/seed.json` as-is; quarantine dual-live losers as `CONFLICTING`; record mismatches |
| Demo script | `npm run test:invariant` — concurrent commits, one 201 / one 409 |

## Out of scope (Part 2 / later)

- Telemetry ingest, trips, dispute screen
- Auth, payments, dealer portal, live webhooks
- Driver-facing plan-change or car-swap flows (ledger/event types may exist; no UX)

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Postgres via Docker Compose + Prisma
- OS target: Linux (README states this)
- Commands: `npm run setup` (install → db up → migrate → seed); `npm run dev` (`:3000`)

## Data model (Part 1)

Prisma models: **Dealer, Plan, Vehicle, Driver, Subscription, DomainEvent, LedgerEntry, DataConflict**.

### Live-commitment invariant

A vehicle has at most one subscription in `{RESERVED, ACTIVE, ENDING}`.

```sql
CREATE UNIQUE INDEX subscriptions_one_live_per_vehicle
ON subscriptions (vehicle_id)
WHERE status IN ('RESERVED', 'ACTIVE', 'ENDING');
```

- Subscription status also includes **`CONFLICTING`** (quarantined seed row; not live; not in the index predicate).
- `vehicles.status` is a **display projection**, not the lock. Bookability = no live commitment and status ≠ `PENDING_INTAKE`.
- Billing price = `subscription.monthlyPrice` (snapshot), not `plans.basePrice`.

### Seed conflict rules

Load every row. Detect and record (do not drop):

1. Multiple live subs per vehicle → keep earliest `startDate` as live; quarantine others → `CONFLICTING` + `data_conflicts`
2. `vehicle.status` vs live-sub mismatch → `data_conflicts`
3. `plan.basePrice` vs `subscription.monthlyPrice` mismatch → flag only (do not rewrite price)
4. Odometer impossibilities → flag

### Early-end ledger policy

- **ENDING** (scheduled): charge through scheduled `endDate` for the open period.
- **Immediate END**: day-prorate.
- Miles: included / used / overage from subscription miles + plan allowance; each ledger row has `explanation` for ops email paste.
- No card charges.

## API / UI surfaces

- `GET` marketplace list (derived bookable set)
- `POST /api/subscriptions` — create commitment (driver + vehicle + plan)
- Early-end mutation on live subscription (ops or marketplace — prefer ops + marketplace action on own sub if simple)
- Ops fleet + conflicts pages; screens must not be empty after seed

## Done when (Part 1)

- [ ] `npm run setup && npm run dev` shows data on marketplace and ops
- [ ] Concurrent commit: one winner, one sensible 409
- [ ] Early end shows defendable ledger rows
- [ ] Ops shows quarantined / conflict decisions from seed

## References

- Fixtures: `data/seed.json` (Part 1), `data/feed.jsonl` (Part 2 — unused here)
- Prior ERD review: seed entities only; polymorphic `DomainEvent.subjectType` ∈ `{subscription, vehicle}`
