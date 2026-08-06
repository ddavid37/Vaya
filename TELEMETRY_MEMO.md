<!-- What we learned from living with feed.jsonl — Part 2 telemetry memo. -->

# Telemetry memo

What the feed taught us, what we trust for miles, and what we refuse to invent.

---

## Setup

- Source: `data/feed.jsonl` (~130 lines), batch-ingested (`npm run db:ingest`) then assembled (`npm run db:assemble`).
- Identity for motion is **IMEI** (device), not marketplace vehicle id.
- Feed VINs **do not appear** in `seed.json` (0 overlap). We treat telemetry as a **parallel pilot dataset** and do not fabricate joins into Part 1 subscriptions.

---

## What “device ≠ vehicle” means here

IMEI `…003` has an explicit `vinChange` (Jul 17): `JM1BPBLM4P1000333` → `3FMCR9B65PR000444`, with an odometer cliff around the same moment. If we billed “one VIN forever under this dongle,” post-move miles would corrupt the wrong car’s invoice.

**Handling:** time-bounded `device_vehicle_assignments`. Trips resolve VIN from fragments or the open assignment at `startAt`. We never sum miles across the VIN boundary into one vehicle bucket without that split.

---

## Mileage policy (show the work)

Inputs usually disagree by ~0.5–1.5 mi on clean trips. Silently averaging them is how you lose a dispute.

| Situation | Trust | Discard |
|---|---|---|
| Monotonic start/end odometer | Odometer delta | `tripDistance` (recorded, not blended) |
| End odo &lt; start (e.g. **TX-480041**) | `tripDistance` when present | Odometer delta |
| Incomplete odometer (common on REST `trip`) | `tripDistance` | — |
| Neither usable | None | Both |

Every trip gets a `mileage_decisions` row with `source`, `trusted_miles`, `discarded_inputs`, and a human `rationale`. Ops reads that on `/ops/disputes`.

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

## Ops screen

`/ops/disputes?imei=&from=&to=` is the “customer says overage is wrong” view: assignment history, trip list, trusted miles sum, and per-trip rationale. It does not invent miles to make the story tidy.

---

## What we would not ship as “truth”

- Averaging odometer and `tripDistance`
- Inventing trips from `tripData` GPS crumbs
- Pretending feed cars are the same as seed marketplace cars without a real link table
- Ignoring `vinChange` and billing one continuous VIN under a dongle

---

## Scale note (15 → 5,000)

Sync batch ingest + in-process assembly is fine for this file. At fleet scale, keep `telemetry_raw` identical and move assembly to async workers first — the dispute schema (trip + mileage decision) stays.
