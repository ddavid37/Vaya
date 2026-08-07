<!-- Architecture choices, forks, and scale seams for the Vaya take-home. -->

# DECISIONS

What we chose and why. Stack: Next.js, TypeScript, Supabase Postgres, Prisma.

The pilot is ~15 cars. The build targets that. Below also names where things would change at ~5,000.

---

## 1. What the system is

Vaya rents physical cars on monthly subscriptions. A car exists once and cannot sit in two live agreements at the same time. At month end someone has to defend a charge in an email. Those two facts drive the rest.

```
Driver UI ──► Marketplace API ──┐
                                ├──► Postgres (system of record)
Ops UI    ──► Ops / telemetry ──┘         │
                                          ├── vehicles, drivers, plans, subscriptions
seed.json (as-is) ──► seed + quarantine   ├── ledger_entries, domain_events, data_conflicts
feed.jsonl ──► ingest → assemble          └── devices, assignments, telemetry_raw,
                                                trips, mileage_decisions
```

Not built (designed around, not implemented): payments, dealer portal, live webhooks (we batch-read `feed.jsonl`), insurer APIs, notification bus.

Code that matters lives in `be/lib/` (`subscriptions.ts`, `mileage.ts`, `driving-health.ts`, …), `be/scripts/` (seed / ingest / assemble), and `fe/app/`.

### Domain objects (short)

| Object | Role |
| --- | --- |
| **Vehicle** | Physical car. VIN identity. Row `status` is display — not the lock. |
| **Driver** | Person who can hold a commitment (Google login upserts one). |
| **Plan** | Catalog: miles, overage rate, list price. |
| **Subscription** | The commitment. Snapshots `monthlyPrice`. Live set = `RESERVED` \| `ACTIVE` \| `ENDING`. |
| **DomainEvent** | Immutable audit for mutations that could show up in a billing email. |
| **LedgerEntry** | Explainable money-shaped facts. No card charges. |
| **DataConflict** | Quarantine when seed/runtime breaks an invariant. Visible in ops. |
| **Device** | Dongle. Identity = IMEI. |
| **DeviceVehicleAssignment** | Time-bounded IMEI↔VIN. Devices move (`vinChange`). |
| **TelemetryRaw** | Exact vendor payload, append-only, idempotent. |
| **Trip** + **MileageDecision** | Assembled trip + which miles we trusted and why. |

### Shapes forced by the data (not by taste)

**1. Availability is not `vehicles.status`.**  
Seed lies: `ENDING` still occupies cars, `RESERVED` looks driven, `veh-004` has two `ACTIVE` rows.  
**Forced:** partial unique index on `subscriptions(vehicle_id)` where status ∈ live set. Vehicle status is a projection; mismatches go to `data_conflicts`.

**2. Price lives on the subscription.**  
Seed has many plan vs subscription price disagreements. Billing from `plans.basePrice` invents charges. Catalog = offer; `subscription.monthlyPrice` = what we owe under.

**3. Device ≠ vehicle.**  
Motion is keyed by IMEI. VIN is missing on some REST pulls. There is a real `vinChange` (IMEI `…003`) with an odometer cliff.  
**Forced:** raw by device; trips carry `imei` + optional `vin`; vehicle only via assignment intervals.

**4. Invoice miles are a decision with provenance.**  
Odo delta and `tripDistance` disagree often; `TX-480041` has end odo below start. Averaging loses disputes.  
**Forced:** `MileageDecision` records what we trusted and why. Ops reads that.

**5. Seed contradictions become rows.**  
Load `seed.json` as-is. Violations → `data_conflicts`. For `veh-004`, earliest `ACTIVE` stays live; the other is `CONFLICTING` (still visible, not in the unique index).

---

## 2. Live-commitment invariant

**Rule:** at most one subscription in `{RESERVED, ACTIVE, ENDING}` per vehicle.

`ENDING` counts — the car is still with the driver until `endDate`.

**Runtime:** transaction → `SELECT … FROM vehicles … FOR UPDATE` → insert/update live sub → partial unique index as backstop → unique violation → **409** `VEHICLE_NOT_AVAILABLE` (never a 500) → domain events + ledger in the same transaction.

**Seed:** detect dual-live; quarantine; do not drop rows.

**Demo:** two Chrome profiles, two Gmails, same free car, Commit together → one wins, one sees the 409. Session driver from Google — not a fake dropdown. Backup: parallel `curl` to `POST /api/subscriptions`.

---

## 3. Mid-flight change (early end)

**Picked:** early end (schedule → `ENDING`, or end now → `ENDED`). Driver manages it on **My cars** (`/mine`) with ledger copy on the same card. Ops fleet is everyone — not a personal cart.

**Why not plan change / car swap as the primary build:** seed already speaks `ENDING` / `end_scheduled`; early end hits the unique-slot boundary hardest. Plan-change ledger types still exist for seed history. Swap is two cars + two odometer handovers — day-two.

**What’s owed without payments:**

- Schedule end → charge through scheduled `endDate` (full period base as documented on the ledger rows)
- End now → prorate by day
- Miles / overage lines from subscription miles + plan allowance  
Each row has a human `explanation` string for an email.

---

## 4. Telemetry (Part 2)

Ops explainability in the same shell — not a second app. Marketplace tables stay separate (feed VINs ≠ seed VINs).

```
feed.jsonl → ingest (telemetry_raw, assignments, connectivity)
           → assemble trips by transactionId
           → mileage_decisions
           → Mileage review (/ops/disputes) + Signals (/ops/signals)
```

Header toggles **Part 1 Marketplace** vs **Part 2 Telemetry**. Part 1 tabs: Marketplace, My cars, Fleet, Conflicts. Part 2: Review, Signals. Floating `?` chat on every route.

Failure modes we handle because they are in the file:

| Mode | Evidence | Handling |
| --- | --- | --- |
| Device moved | `vinChange` + odo cliff on IMEI `…003` | Assignment intervals; don’t sum miles across the VIN boundary |
| Delayed metrics | disconnect/reconnect burst on `…002` | Store raw; mark `METRICS_DELAYED` |
| Out of order / bad odo | TX-480041 before TX-480040; end &lt; start | Order by trip time; flag; prefer `tripDistance` with a note |
| Duplicate fragments | duplicate `tripEnd`; revised metrics | Idempotent keys; audit prior metrics |
| REST vs webhook | REST `trip` has no VIN | Same trip row; VIN from assignment at start |
| Sparse `tripData` | breadcrumbs only | Store raw; do not invent trips |

---

## 5. Where 15 → 5,000 snaps

| Seam | At 15 | At 5,000 | Replace first |
| --- | --- | --- | --- |
| Commitment lock | `FOR UPDATE` on vehicle | Hot-car contention | Short TTL lease + outbox; keep the unique index |
| Ops dispute UI | One screen | Search + paging | Same schema; indexes + query API |
| Telemetry ingest | Sync jsonl | Webhook flood | Queue + worker; same `telemetry_raw` |
| Trip assembly | Fine inline | CPU on read path | Async materialize from raw |
| Partial unique index | Perfect | Still perfect | Keep |
| Single Postgres | Fine | Reporting vs OLTP | Replica / warehouse for analytics |

**First real replacement at scale:** sync assembly → async workers. The commitment model stays.

---

## 6. Forks (roads not taken)

**A — Lock on `vehicles.status` vs on subscriptions**  
Picked: partial unique index + `FOR UPDATE`. Rejected: flip vehicle status as the lock. Seed already lies; two writers both read AVAILABLE and both win.

**B — SQLite / Docker Postgres vs Supabase**  
Picked: Supabase + Prisma. SQLite is weak for the concurrency demo; Docker is extra surface for a take-home. Cost: cloud project + pooler URL for serverless.

**C — Early end vs plan change vs car swap**  
Picked: early end (see §3). Plan change and swap stay out of the primary driver flow.

**C2 — Where does the driver early-end?**  
Picked: **My cars**. Rejected: hunting inside full Ops fleet. Fleet truth ≠ personal cart.

**D — Seed dual-ACTIVE**  
Picked: load both; quarantine loser as `CONFLICTING`; winner = earlier `startDate` (`sub-004`). Rejected: fail the load (empty demo) or keep both ACTIVE (breaks the invariant).

**E — Invoice miles**  
Picked: prefer monotonic, assignment-stable odometer; else `tripDistance`; never average; always write why. Averaging and blind odo both lose real disputes in this feed.

**F — Feed VINs vs seed VINs**  
Picked: parallel datasets. Rejected: invent a join. Memo says so.

**G — Header: Driver/Operator vs Part 1/Part 2**  
Picked: Part 1 / Part 2 (matches the brief and the table split). Tried roles first; Disputes got blurred into “ops” next to Fleet.

**H — Driving health**  
Picked: composite heuristic (fuel, speed, hard events, idle, data flags) with the math on the card (`driving-health.ts`). Rejected: fuel-only or LLM-invented scores. Demo thresholds — labeled as such. Trip card frame + label use that health color.

**I — Handwriting / insurance / scans**  
Picked: persisted manual mileage confirm; insurance + scanning as placeholders. Rejected: full document vault / real insurer API. Attacks “only evidence was handwriting” now; cams/APIs are later (see memo).

---

## 7. Calls the brief left open

| Topic | Decision |
| --- | --- |
| Who is ops? | `/ops` open for the pilot (no Google). Marketplace uses Google so two real accounts can race. |
| Dealers | Seed has three; marketplace shows all bookable cars. |
| `RESERVED` TTL | Treat as live until activated/cancelled (seed holds are months old). |
| `PENDING_INTAKE` | Not bookable; ops only. |
| Timezone | Store UTC; display America/New_York. |
| Overage | Use plan `overagePerMile`, not a hardcoded $0.30. |
| OS | macOS — stated in README. |

---

## 8. Build scope

**Built**

- Part 1: browse/commit, My cars early end + ledger, fleet, conflicts, seed quarantine, Google Auth.js, concurrent-safe commit.
- Part 2: ingest/assemble, Mileage review (metrics, health, manual confirm, ★ AI summary), Signals, failure-mode tests, floating contextual chat.
- Docs: this file, HOW-I-BUILT-IT, TELEMETRY_MEMO, README, DB.md.

**Not built**

- Payments / refunds  
- Dealer portal  
- Live webhook server  
- Real insurer models  
- Driver mobile / push  
- GPS playback from `tripData`  
- Fabricated marketplace↔feed VIN joins  

**If there were another day:** ops auth, plan-change UX, real webhook + replay, car-swap with dual odometer, link table once product confirms VIN identity.
