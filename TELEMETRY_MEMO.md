<!-- What we learned from living with feed.jsonl — Part 2 telemetry memo. -->

# Telemetry memo

What the feed taught us, what we will defend in an email, and what we still cannot answer.

Vaya’s pilot pain is not “we lack dashboards.” It is three costs: **billing** pinned to two handwritten odometer reads months apart; **insurance** priced as one fleet rate because we cannot describe how anyone drives; and **operations blind spots** (when damage happened, who was driving, a car sitting outside plan area). This memo is the judgment after living with `feed.jsonl` — not a feature list.

---

## Setup

- Source: `data/feed.jsonl` (~130 lines), batch-ingested (`npm run db:ingest`) then assembled (`npm run db:assemble`).
- Identity for motion is **IMEI** (device), not marketplace vehicle id.
- Feed VINs **do not appear** in `seed.json` (0 overlap). We treat telemetry as a **parallel pilot dataset** and do not fabricate joins into Part 1 subscriptions. That honesty costs a single-pane “this subscriber’s overage from the dongle” demo — inventing the join would be worse.

---

## 1. Routes — what is actually possible

There is more than one way to get data out of a car. They are **not** variations on one “miles API.” Each route has different physics, failure modes, and a hard ceiling on what it can ever prove.

| Route | What it can deliver | What it cannot | In this feed |
|---|---|---|---|
| **A. Human odometer at handover / return** | Two numbers months apart; period delta for a clipboard invoice | Continuous trips, who drove mid-term, when damage happened, where the car sat | Still how the $252 vignette is pinned today; we log confirms on Review as a second reading, not as truth |
| **B. Dongle trip envelope** (`tripStart` / `tripEnd`, keyed by IMEI) | Time-bounded start/end odometer, fuel on end, VIN when the webhook includes it | Proof of *which person* drove; stable vehicle identity if the dongle moves | Dominant path; `vinChange` on IMEI `…003` proves device ≠ vehicle |
| **C. Vendor trip aggregate** (`tripMetrics`: `tripDistance`, speeds, hard events, idle, `tripTime`) | Behavior + a second distance estimate for the same `transactionId` | A replacement for odometer when they disagree; a location history | Arrives late after disconnects (IMEI `…002`); not the same sensor as (B) |
| **D. REST `trip` pull** | Compact trip-shaped payload when webhook was missed | Often no VIN; often incomplete odometer — same trip, thinner evidence | Normalized into the same `trips` row; VIN may come from assignment |
| **E. Sparse GPS crumbs** (`tripData`) | Occasional lat/lon/speed samples (e.g. a handful of points over minutes) | Continuous track, “sat 90 mi outside plan for three weeks,” or inventable trips | 3 events in the file; store raw only — **not** trips |
| **F. Health flags** (`mil`, `battery`) | Fault / power signals for ops | Billing miles or how carefully someone drives | Present; out of invoice scope |
| **G. Delivery channel** (webhook vs REST, connect/disconnect) | How and when fragments arrived | New physical facts about the car | Explains `METRICS_DELAYED` and burst catch-up — ops metadata, not a mile source |

**Unavailable at any price from this class of feed** (not “we didn’t build the UI”):

- Authenticated **driver identity** on a trip (no key fob / app / biometric in the stream)
- **Damage / condition clock** (no before/after imagery or body sensors)
- **Continuous geofence presence** (crumbs ≠ a month of whereabouts)
- A guaranteed **device↔VIN** bond without assignment discipline (`vinChange` exists because the bond can break)
- A single “miles” number that is simultaneously odometer truth and vendor `tripDistance` — they disagree by ~0.5–1.5 mi on clean trips; averaging invents a third fiction

Policy below only chooses among routes that can actually deliver miles. It does not pretend (E)–(G) or driver/damage channels exist.

---

## Billing — replace “a number somebody typed”

The brief’s overage vignette (6,840 driven, 840 over, $252 at $0.30/mi) is the email we must eventually defend. Route (A) still exists in the real world; routes (B)+(C) make **period miles** reconstructible trip-by-trip with provenance, so a dispute is not only “our clipboard vs their memory.”

### Device ≠ vehicle (route B breaks without this)

IMEI `…003` has an explicit `vinChange` (Jul 17): `JM1BPBLM4P1000333` → `3FMCR9B65PR000444`, with an odometer cliff (~34428 → ~12703). Billing “one VIN forever under this dongle” would put post-move miles on the wrong car’s invoice.

**Handling:** time-bounded `device_vehicle_assignments`. Trips resolve VIN from fragments or the open assignment at `startAt`. We never sum miles across the VIN boundary into one vehicle bucket without that split.

### Mileage policy — choosing between (B) and (C)

| Situation | Trust | Discard |
|---|---|---|
| Monotonic start/end odometer | Odometer delta (B) | `tripDistance` (C) — recorded, not blended |
| End odo &lt; start (e.g. **TX-480041**) | `tripDistance` when present | Odometer delta |
| Incomplete odometer (common on REST `trip`) | `tripDistance` | — |
| Neither usable | None | Both |

Every trip gets a `mileage_decisions` row with `source`, `trusted_miles`, `discarded_inputs`, and a human `rationale` (`lib/mileage.ts`). Ops reads that on `/ops/disputes`. Period trusted miles = sum of those decisions for the IMEI/window.

---

## Failure modes we actually saw

| Mode | In the feed | What we do |
|---|---|---|
| Device moved | `vinChange` on IMEI `…003` | Close/open assignment intervals |
| Disconnect / delayed metrics | IMEI `…002` Jul 9–11 | Store raw; flag `METRICS_DELAYED` when metrics arrive ≫ after end |
| Out-of-order / impossible odo | TX-480041 end &lt; start | Prefer tripDistance; status `IMPOSSIBLE_ODOMETER` |
| Duplicate fragments | Extra `tripEnd` / revised metrics | Distinct `natural_key` by `deliveredAt`; last delivered wins for metrics with flags |
| REST vs webhook | REST `trip` often no VIN | Same `trips` row; VIN from assignment when needed |
| Sparse GPS | `tripData` breadcrumbs | Raw only — **not** trips |
| MIL / battery | Present | Raw only — out of invoice scope |

---

## Insurance — route (C), not underwriting

After the cars, insurance is the largest cost; today the book is one rate because we cannot tell careful from careless.

Route (C) gives hard braking / hard acceleration, average and peak speed, idle share of trip time. We surface those plus a **demo composite driving health** on Review/Signals (`lib/driving-health.ts`) — enough to **rank devices in a pilot** and start a renewal conversation.

It is **not** an insurer model: thresholds are heuristics; **driver is unknown** (unavailable on this feed); feed cars are not linked to Part 1 subscribers. Next real step is driver↔device binding and carrier-shaped aggregates (e.g. hard events per 100 trusted miles), not a prettier score.

---

## What we still cannot answer

| Situation from the brief | Route reality |
|---|---|
| Overage dispute / “charge is wrong” | **Shape addressed** via (B)+(C) provenance on `/ops/disputes` (+ optional logged (A)). Full 6,840/$252 subscription email needs VIN↔subscription link we refuse to invent. |
| Who was driving | **Unavailable at any price** on this feed |
| When damage occurred | **Unavailable** — no condition channel; scan UI is placeholder only |
| Car sat outside plan area for weeks | **Unavailable** from sparse (E); inventing geofences would fake certainty |

---

## Ops screens

- **`/ops/disputes`** — dispute view over (B)+(C): assignments, trips, trusted miles, rationale, critical metrics, idle, health. Does not invent miles.
- **`/ops/signals`** — (C) rollups across devices. Sketch, not a carrier export.

---

## What we would not ship as “truth”

- Averaging odometer (B) and `tripDistance` (C)
- Inventing trips or geofences from `tripData` (E)
- Pretending feed cars are seed marketplace cars without a real link table
- Ignoring `vinChange` and billing one continuous VIN under a dongle
- Selling the driving-health heuristic as underwriting

---

## Scale note (15 → 5,000)

Sync batch ingest + in-process assembly is fine for this file. At fleet scale, keep `telemetry_raw` identical and move assembly to async workers first — the dispute schema (trip + mileage decision + assignment intervals) stays.
