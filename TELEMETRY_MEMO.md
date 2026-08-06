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

## Billing — replace “a number somebody typed”

The brief’s overage vignette (6,840 driven, 840 over, $252 at $0.30/mi) is the email we must eventually defend. Handwriting at handover/return still exists in the real world; telemetry’s job is to make the **period miles** reconstructible trip-by-trip with provenance, so a dispute is not “our clipboard vs their memory.”

### Device ≠ vehicle

IMEI `…003` has an explicit `vinChange` (Jul 17): `JM1BPBLM4P1000333` → `3FMCR9B65PR000444`, with an odometer cliff (~34428 → ~12703). Billing “one VIN forever under this dongle” would put post-move miles on the wrong car’s invoice.

**Handling:** time-bounded `device_vehicle_assignments`. Trips resolve VIN from fragments or the open assignment at `startAt`. We never sum miles across the VIN boundary into one vehicle bucket without that split.

### Mileage policy (show the work)

Inputs usually disagree by ~0.5–1.5 mi on clean trips. Silently averaging them is how you lose a dispute.

| Situation | Trust | Discard |
|---|---|---|
| Monotonic start/end odometer | Odometer delta | `tripDistance` (recorded, not blended) |
| End odo &lt; start (e.g. **TX-480041**) | `tripDistance` when present | Odometer delta |
| Incomplete odometer (common on REST `trip`) | `tripDistance` | — |
| Neither usable | None | Both |

Every trip gets a `mileage_decisions` row with `source`, `trusted_miles`, `discarded_inputs`, and a human `rationale` (`lib/mileage.ts`). Ops reads that on `/ops/disputes`. Period trusted miles = sum of those decisions for the IMEI/window — explainable line items, not a single opaque total.

Manual mileage confirm on Review is a **logged second reading** next to feed-derived miles — better evidence than an unlabeled spreadsheet cell, not a substitute for the trip ledger.

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

## Insurance — one useful signal, not underwriting

After the cars, insurance is the largest cost; today the book is one rate because we cannot tell careful from careless.

From `tripMetrics` we surface hard braking / hard acceleration, average and peak speed, idle share of trip time, and a **demo composite driving health** on Review/Signals (`lib/driving-health.ts`). That is enough to **rank devices in a pilot** and start a renewal conversation (“these IMEIs show elevated hard-brake density; these do not”).

It is **not** an insurer model: thresholds are heuristics; **driver is unknown** on trips; feed cars are not linked to Part 1 subscribers. We will not pretend a green/yellow frame is a rate filing. Next real step would be stable driver↔device binding and carrier-shaped aggregates (e.g. hard events per 100 trusted miles), not a prettier score.

---

## What we still cannot answer

| Situation from the brief | With this feed |
|---|---|
| Overage dispute / “charge is wrong” | **Addressed in shape:** trip list + trusted miles + rationale (+ optional logged confirm). Not the full 6,840/$252 subscription email until VIN↔subscription is real. |
| Who was driving when something happened | **Still blind** — feed has no driver identity; UI shows `unknown`. |
| When damage occurred | **Still blind** — no condition timeline; vehicle scan UI is a placeholder only. |
| Car sat ~90 mi outside plan area for weeks | **Still blind** — `tripData` GPS is sparse breadcrumbs; we store raw and refuse to invent trips or geofence alerts from crumbs. |

Owning these gaps matters as much as the mileage policy: inventing answers would recreate the handwriting problem in software.

---

## Ops screens

- **`/ops/disputes`** — “customer says overage is wrong”: assignment history, trip cards, trusted miles sum, per-trip rationale, critical metrics, idle, driving health. Does not invent miles to tidy the story.
- **`/ops/signals`** — insurance-adjacent rollups (avg/max speed, hard events) across the ingested devices. Sketch, not a carrier export.

---

## What we would not ship as “truth”

- Averaging odometer and `tripDistance`
- Inventing trips or geofences from `tripData` GPS crumbs
- Pretending feed cars are the same as seed marketplace cars without a real link table
- Ignoring `vinChange` and billing one continuous VIN under a dongle
- Selling the driving-health heuristic as underwriting

---

## Scale note (15 → 5,000)

Sync batch ingest + in-process assembly is fine for this file. At fleet scale, keep `telemetry_raw` identical and move assembly to async workers first — the dispute schema (trip + mileage decision + assignment intervals) stays. The commitment/billing model in Part 1 does not need to change for that step.
