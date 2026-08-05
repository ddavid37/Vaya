# DECISIONS

Built on Linux. Stack: Next.js (App Router), TypeScript, Postgres, Prisma — Vaya's path of least explanation.

---

## 1. Architecture (the widest view)

### What this system is

Vaya rents physical cars on monthly subscriptions. A car exists once, sits in one place, and cannot be in two live agreements at the same time. At month end someone has to defend a charge in an email. Those two facts shape everything below.

The pilot is ~15 cars. The architecture below is wider than what we will build for the assignment. The build targets the pilot; the diagram shows where the seams are when the fleet is 5,000.

### Pieces and who talks to whom

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Clients                                    │
│   Driver marketplace UI          Ops console (fleet + billing defense)  │
└───────────────┬─────────────────────────────┬───────────────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────────┐   ┌─────────────────────────────────────┐
│     Marketplace API           │   │           Ops API                   │
│  browse / reserve / activate  │   │  fleet state / conflicts / ledger   │
│  mid-flight mutations         │   │  dispute workspace (Part 2 screen)  │
└───────────────┬───────────────┘   └──────────────────┬──────────────────┘
                │                                      │
                ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Domain services (in-process)                        │
│  CommitmentService   BillingLedgerService   FleetProjection             │
│  TelemetryIngestor   TripAssembler        MileageForInvoice             │
└───────────────┬─────────────────────────────┬───────────────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────────┐   ┌─────────────────────────────────────┐
│     Postgres (system of       │   │   Append-only stores                │
│     record)                   │   │   - domain_events (marketplace)     │
│  vehicles, drivers, plans,    │   │   - telemetry_raw (vendor payloads) │
│  subscriptions, ledger_entries│   │   - device_vehicle_assignments      │
│  data_conflicts               │   │   - trips (assembled)               │
└───────────────────────────────┘   └─────────────────────────────────────┘
                ▲
                │ load-as-is + quarantine
┌───────────────┴───────────────┐   ┌─────────────────────────────────────┐
│  seed.json (Part 1)           │   │  feed.jsonl → TelemetryIngestor     │
└───────────────────────────────┘   └─────────────────────────────────────┘

Not in this build (designed for, not implemented):
  Payment processor (Stripe etc.) — ledger computes; nothing charges a card
  Dealer portal / DMS sync
  Real-time webhook listener — we batch-ingest feed.jsonl
  Insurance carrier API
  Customer notification bus
```

### Core domain objects

| Object | Role |
|---|---|
| **Vehicle** | Physical asset. Identity is VIN. Status on the row is a *projection*, not the lock. |
| **Driver** | The human who can hold a commitment. |
| **Plan** | Catalog: name/tier, monthly miles, overage rate, list price. |
| **Subscription** | The commitment. Snapshots `monthlyPrice` and plan terms at the moment they matter. Status ∈ {`RESERVED`, `ACTIVE`, `ENDING`, `ENDED`}. |
| **DomainEvent** | Immutable audit trail for every mutation that could appear in a billing email. |
| **LedgerEntry** | Explainable money-shaped facts (base period, plan-change proration, overage). No card charges. |
| **DataConflict** | Quarantine record when seed or runtime state violates an invariant. Visible in ops. Never silently averaged away. |
| **Device** | Telematics unit, identity = IMEI. |
| **DeviceVehicleAssignment** | Time-bounded IMEI↔VIN binding. A device can move; a VIN can change under a device (`vinChange`). |
| **TelemetryRaw** | Exact vendor payload, append-only, idempotent on a natural key. |
| **Trip** | Assembled billing/ops unit from `tripStart`/`tripEnd`/`tripMetrics` (and REST `trip`) fragments. |

### Data model: where it diverges from the obvious shape

**1. Availability is not `vehicles.status`.**

The obvious model: `AVAILABLE` means bookable, `SUBSCRIBED` means taken. Seed data breaks this on contact — `ENDING` subscriptions still occupy cars, `RESERVED` cars have miles-this-period as if they were driving, and `veh-004` has **two `ACTIVE` subscriptions**. If marketplace reads `vehicles.status`, the invariant is theater.

Forced shape: a **partial unique index** on `subscriptions(vehicle_id)` where `status IN ('RESERVED','ACTIVE','ENDING')`. Live commitment = that set. Vehicle status is derived for display and repaired into `data_conflicts` when it disagrees with the index.

**2. Price lives on the subscription, not on a join to `plans`.**

Seed has ~10 plan/vehicle/subscription price disagreements. Billing that joins `plans.basePrice` invents charges. Catalog price is what we *offer*; `subscription.monthlyPrice` is what we *owe under*. Plan changes write ledger rows and keep `previousPlanId` / prior price for the email.

**3. Device ≠ vehicle.**

The feed's natural key for motion is IMEI. VIN appears on most webhook events and is absent on some REST pulls. There is an explicit `vinChange` (IMEI `…003`: `JM1BPBLM4P1000333` → `3FMCR9B65PR000444`) and an odometer cliff at the same moment. Modeling trips as `vehicle_id + distance` corrupts billing the day someone moves a dongle. Forced shape: raw events keyed by device; trips carry `imei`, optional `vin`, and resolve `vehicle_id` only through assignment intervals.

**4. Miles for invoice are a *decision with provenance*, not a column.**

Odometer deltas and `tripDistance` disagree by ~0.5–1.5 mi on almost every clean trip; one trip (`TX-480041`) has end odometer *below* start. Silently averaging that is how you lose a dispute. Forced shape: `MileageForInvoice` records which inputs it trusted, which it discarded, and why — the ops dispute screen reads that record.

**5. Seed contradictions become rows, not cleanup.**

Load `seed.json` as-is. Each violation inserts a `data_conflicts` row (type, subjects, chosen resolution, rationale). Ops lists them. Marketplace uses the resolution (e.g. earliest-started ACTIVE wins the unique slot for `veh-004`; the other is quarantined to `CONFLICTING` and does not count as a second live commitment in the index — both remain visible).

### Live-commitment invariant

**Rule:** a vehicle has at most one subscription in `{RESERVED, ACTIVE, ENDING}` at any time.

**Why `ENDING` counts:** the car is still in the driver's hands until `endDate`. Releasing it early for a second booking is how you double-hand a physical object.

**Enforcement (runtime):**

1. `BEGIN`
2. `SELECT … FROM vehicles WHERE id = $1 FOR UPDATE`
3. Attempt `INSERT`/`UPDATE` subscription into a live status
4. Partial unique index is the backstop; conflict → map to `409` with a clear body (`code: VEHICLE_NOT_AVAILABLE`), never a 500
5. Append `domain_events` + any ledger rows in the same transaction
6. `COMMIT`

**Enforcement (seed load):** detect dual-ACTIVE (and status drift); quarantine; do not drop rows.

**Proof for the video:** concurrent `POST /api/subscriptions` against the same vehicle (script + UI), one 201, one 409; DB query shows a single live row.

### Mid-flight change (Part 1 pick)

**Choice: end the subscription early** (schedule → `ENDING`, then `ENDED` on the end date / immediate ops end).

Why this one over swap-car or change-plan:

- Seed already has `ENDING`, `end_scheduled`, `cancelled`/`reinstated` — the product language is in the data.
- It exercises the invariant boundary (when does the unique slot free?) more sharply than a plan change.
- Plan change is still modeled (ledger + event types) because seed has `subscription.plan_changed`; we will not build the driver-facing plan-change flow in Part 1.
- Car swap is the most operationally heavy (two vehicles, two odometer handovers) and deserves its own day.

**What "know what's owed" means without moving money:**

On early end inside a billing period, write ledger entries:

- `PERIOD_BASE` — full monthly price for the open period (or document the policy: charge through period end vs prorate; we pick **charge through scheduled endDate if ENDING, prorate by day if immediate END** and say so on the record)
- `MILES_INCLUDED` / `MILES_USED` / `OVERAGE` — from subscription miles + plan allowance, with source notes
- Human-readable `explanation` string on each row so ops can paste into an email

### Telemetry pipeline (Part 2)

```
feed.jsonl
   │
   ▼
TelemetryIngestor
   │  idempotent upsert → telemetry_raw
   │  side effects:
   │    - deviceDisconnect/Connect → connectivity intervals
   │    - vinChange → close/open device_vehicle_assignments
   │    - trip* → TripAssembler
   ▼
TripAssembler (by transactionId)
   │  prefers event timestamps over deliveredAt (out-of-order: TX-480041 vs TX-480040)
   │  dedupes duplicate tripEnd/tripMetrics
   │  REST `trip` is a complete alternate shape for the same logical trip
   ▼
trips + mileage_decisions
   │
   ▼
Ops dispute screen: "customer says overage is wrong"
   show period, trusted miles, rejected fragments, device assignment at each trip
```

Failure modes the schema/tests must survive (from the file, not invented):

| Mode | Evidence in feed | Handling |
|---|---|---|
| Device moved between cars | `vinChange` + odometer reset ~34428 → ~12703 on IMEI `…003` | Assignment intervals; never sum miles across the VIN boundary into one vehicle invoice |
| Out of signal / delayed metrics | IMEI `…002` disconnect Jul 9, reconnect Jul 11; metrics for TX-014..018 arrive in a burst at reconnect | Store raw; assemble when fragments exist; mark trips `METRICS_DELAYED` |
| Out-of-order delivery | TX-480041 delivered before TX-480040; end odo < start odo | Order by trip time; flag impossible odometer; prefer `tripDistance` with explicit note |
| Duplicate fragments | duplicate `tripEnd` for TX-480005/036/039; revised metrics for TX-480005 | Idempotent keys; last-writer-wins only for metrics with audit of prior value |
| REST vs webhook shape | REST `trip` has no VIN, nested differently | Normalize into same trip row; VIN from active assignment at `startTime` |
| Sparse GPS / tripData | `tripData` breadcrumbs, not trips | Store raw; do not invent trips from them |
| MIL / battery | present, not billing inputs | Store; out of invoice scope |

### Where 15 → 5,000 snaps (build for 15; name the break)

| Seam | At 15 | At 5,000 | Replace first |
|---|---|---|---|
| Commitment lock | Row `FOR UPDATE` on vehicle | Lock contention on hot cars / multi-region | Lease/reservation service with short TTL + outbox; still one DB unique constraint as truth |
| Ops dispute UI | One screen, scan a month of trips | Need search by driver/VIN/period and paging | Same schema; add indexes + query API (not a redesign) |
| Telemetry ingest | Sync read of jsonl at boot | Webhook flood, retries, backfill | Queue + worker; keep `telemetry_raw` identical |
| Trip assembly in request path | Fine | CPU on read path | Materialize trips asynchronously from raw |
| Partial unique index | Perfect | Perfect — this does not snap | Keep forever |
| Single Postgres | Fine | Reporting vs OLTP fight | Read replica / warehouse for analytics; OLTP keeps commitments |

**First replacement at scale:** synchronous telemetry assembly → async workers. The commitment model stays.

---

## 2. Forks (roads not taken)

### Fork A — Enforce the invariant on `vehicles.status` vs on subscriptions

- **Picked:** partial unique index on live subscriptions + `FOR UPDATE` on the vehicle row.
- **Rejected:** `UPDATE vehicles SET status='SUBSCRIBED' WHERE status='AVAILABLE'` as the lock.
- **Appeal of rejected:** matches how the seed is shaped; fewer joins on the browse page.
- **Cost of rejected:** seed already lies; two writers both read AVAILABLE and both win; Part 1's simultaneous-commit requirement fails under concurrency. Status becomes a cache we can recompute.

### Fork B — SQLite for one-command demo vs Postgres

- **Picked:** Postgres (Docker) + Prisma, matching Vaya.
- **Rejected:** SQLite file in-repo for zero-Docker setup.
- **Appeal of rejected:** truly one binary less on a clean machine; partial indexes work.
- **Cost of rejected:** `FOR UPDATE` / isolation semantics differ; we'd re-explain every concurrency demo. Docker Compose is the setup tax; worth it.

### Fork C — Mid-flight: early end vs plan change vs car swap

- **Picked:** early end (see above).
- **Rejected for primary build:** plan change (data already hints at it); car swap.
- **Cost of not building plan change UX:** miss a nice ledger story — mitigated by still recording plan-change-shaped ledger types and surfacing seed's `sub-009` history in ops.
- **Cost of not building swap:** no dual-vehicle handover UX — acceptable for pilot scope; swap is a day-two feature that reuses the same invariant.

### Fork D — Seed dual-ACTIVE: pick winner vs refuse to load vs keep both live

- **Picked:** load both; quarantine loser as `CONFLICTING`; winner = earlier `startDate` (`sub-004`); ops banner explains it.
- **Rejected:** fail seed load (blocks "no empty screens"); or keep both ACTIVE (breaks the invariant we're proving).
- **Cost of picked:** marketplace and DB invariant disagree with literal seed statuses until you read conflict rows — that's the point of the ops screen.

### Fork E — Invoice miles: always odometer delta vs always vendor `tripDistance`

- **Picked:** prefer odometer delta when start/end present, monotonic, and assignment-stable; else `tripDistance`; never average; always write provenance.
- **Rejected:** average the two; or always trust odometer.
- **Cost of always-odometer:** `TX-480041` and post-`vinChange` cliffs bill nonsense.
- **Cost of always-distance:** systematic ~1 mi under-read vs odo on clean trips; still better than negative miles — but we can do better with a rule, not a blend.

### Fork F — Feed VINs vs seed VINs

Feed VINs (`1HGCV1F…`, `JM1BPB…`, etc.) **do not appear** in `seed.json`. Options: fabricate joins, or treat telemetry as a parallel pilot dataset.

- **Picked:** parallel dataset. Part 2 ops screen is driven by ingested devices/trips; optional manual link table later. Memo will say so.
- **Rejected:** fuzzy-match or rewrite seed VINs.
- **Cost:** no single-pane "this subscriber's overage from the dongle" without a link step — honest to the files we were given.

---

## 3. Calls the brief left unspecified

| Topic | Decision |
|---|---|
| Who is "ops"? | Single unauthenticated ops area under `/ops` for the pilot demo (no auth provider). Flag as day-two. |
| Dealer scope | Pilot copy talks about one dealer; seed has three. Marketplace shows all bookable cars; ops can filter by dealer. |
| `RESERVED` hold TTL | Seed reservations are months old. Treat RESERVED as live forever until activated/cancelled in this build; ask about TTL on Slack. |
| `PENDING_INTAKE` | Not bookable; show in ops only. |
| Timezone | Display America/New_York; store UTC. Seed return event has a naive timestamp — preserve raw, interpret as NY. |
| Overage example ($252 / 840 mi) | Matches `$0.30` × 840; use plan `overagePerMile` from catalog when computing ledger, not a hardcoded 0.30. |
| OS | Linux (this environment). README will state it. |

### What I would ask on Slack

1. Reserved hold: auto-expire after N hours, or floor-manager only?
2. Early end: bill through period end, or day-prorate? (Building both policies behind a flag is worse than one written choice — currently: ENDING keeps charge through `endDate`; immediate END prorates.)
3. Are feed vehicles intentionally not in seed (separate telemetry pilot), or a packaging miss?
4. Is `ENDING` still insured/billable as ACTIVE until `endDate`? (Assuming yes.)

### Next, in order, with another day

1. Auth (driver sessions + ops role).
2. Plan-change mid-cycle UX on top of existing ledger types.
3. Real webhook endpoint + replay tool (same ingestor).
4. Car-swap flow with dual odometer capture.
5. Link table from telemetry VIN/IMEI → fleet vehicle once product confirms identity.

---

## 4. Build scope vs designed-but-out

**Building**

- Part 1: marketplace browse/commit, ops fleet view, invariant + concurrent-safe API, early end with ledger, seed load with conflict quarantine, screens never empty.
- Part 2: migrated telemetry schema, jsonl ingestion, dispute screen, tests per failure mode above.
- Docs: this file, HOW-I-BUILT-IT, telemetry memo, README with two commands.

**Deliberately not building**

- Payments, refunds, card vault.
- Dealer-facing portal.
- Live webhook server (batch ingest only).
- Insurance scoring product (memo territory).
- Driver mobile app / push.
- Perfect GPS playback from `tripData`.
