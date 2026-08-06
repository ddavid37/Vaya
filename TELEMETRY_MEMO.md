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

## 2. Cost it — fifteen cars, first year

**Assumed stack** (matches routes B/C/E in the feed): one OBD/cellular gateway per car + vendor platform that emits trip envelopes, trip metrics, and occasional GPS crumbs. **No dashcams** in the base case (cameras are a different product; this feed does not include them). The feed does not name a vendor, so dollars below are a **pilot budget model**, not a signed quote.

### What we confirmed vs guessed

| Claim | Status | Note |
|---|---|---|
| Major fleet platforms (Samsara, Geotab-class) do **not** post a simple commercial $/vehicle on the marketing site — you get a quote | **Confirmed** | Public pricing pages are quote/funnel; reseller-led |
| Samsara Sourcewell cooperative list: Vehicle Gateway license **$39 / vehicle / month** (LIC-VG-ENT); public-sector lighter SKU **$23** | **Confirmed** (published cooperative sheet, cited in 2026 industry writeups) | Government path, not Vaya’s likely commercial quote |
| Geotab-class commercial SaaS often lands ~**$25–40 / vehicle / month** via resellers | **Guess band** (secondary reviews / reseller commentary) | Package depth varies |
| Hardware gateway often ~**$80–150** one-time when not bundled | **Guess band** | Sometimes amortized into the monthly |
| Install on a dealer lot, spare pool, ops time, our assemble/dispute stack | **Guess** | Never on the vendor sticker |

### Working numbers (mid case) — label: mostly guessed

All figures USD. “Per car / month (year-1)” amortizes one-time items over 12 months.

| Line item | On vendor pricing page? | Amount | Fleet (15) year-1 | Per car / mo year-1 | Confirmed / Guess |
|---|---|---|---|---|---|
| Platform SaaS (trip + metrics, no cam) | Partially — quote only commercially; **$39** is a confirmed *gov list* anchor | **$32** / car / mo | $5,760 | $32.00 | **Guess** (inside $25–40 band; not our quote) |
| Gateway hardware | Sometimes separate | **$125** / car once | $1,875 | $10.42 | **Guess** |
| Install / move at lot (incl. `vinChange` swaps) | No | **$75** / car once + **$200** fleet contingency | $1,325 | $7.36 | **Guess** |
| Spare dongles (failures / swaps) | No | **2** units @ $125 | $250 | $1.39 | **Guess** (feed shows device moves; buy spares) |
| Ops labor (reconnect bursts, assignment hygiene, dispute minutes) | No | **~2 hr / mo** @ $50 loaded | $1,200 | $6.67 | **Guess** (IMEI `…002` delay pattern is real; hours are not) |
| Vaya ingest / assemble / dispute tooling + webhook host (pilot year) | No | **~$250 / mo** shared | $3,000 | $16.67 | **Guess** (eng+infra; not vendor SaaS) |
| **Total mid case** | | | **~$13,410** | **~$74.50** | Blended |

**Per car, per month, first year (mid): ~$75.**  
**Fifteen cars, first year (mid): ~$13.4k.**

### Band (still guesses)

| Case | $/car/mo year-1 | 15-car year-1 | What changed |
|---|---|---|---|
| Low | ~$50 | ~$9k | SaaS nearer $22, cheap install, lighter eng |
| Mid (above) | ~$75 | ~$13.4k | Working case |
| High (still no cams) | ~$110 | ~$20k | SaaS nearer $45, more dispute/ops load, pricier hardware |

Adding dual-facing AI cams (often **+$40–55 / mo** on published gov sheets, hardware extra) would jump the pilot sharply and still would **not** appear in `feed.jsonl` — out of this base cost.

### What this buys vs what it does not

~$75/car/mo year-1 buys routes **B+C** (defendable trip miles + behavior signals) and sparse **E**. It does **not** buy driver identity, damage clocks, or continuous geofence — those are unavailable on this feed class, not a line item we forgot.

**Before committing:** get a named commercial quote for 15 gateways (hardware included or not, install, term, overage for API/webhooks) and replace every **Guess** SaaS/hardware row. Ops and Vaya tooling rows will remain internal estimates.

---

## 3. What is worth paying for

The cheap end of this market (~$10–20/car/mo class trackers) and the expensive end (full platform + AI cams, often several× that) are not “more of the same miles.” They buy different **physical capabilities**. Pricing pages bury that. For Vaya’s three costs, here is the cut I would make.

### Pay for (worth the step up from cheap GPS)

| Capability | Why it is worth money for Vaya | Evidence from living with the feed |
|---|---|---|
| **Trip-bounded odometer start/end** (route B), not only a live map pin | Overage disputes need reconstructible period miles with provenance — a breadcrumb map does not defend $252 | Clean trips disagree odo vs `tripDistance` by ~0.5–1.5 mi; we need both inputs and a rule, not a single “distance” tile |
| **Vendor trip metrics on the same `transactionId`** (route C): hard brake/accel, idle, speeds, second distance | Insurance conversation needs *how they drive*, not only *that they moved*; also fallback miles when odo is impossible | TX-480041; hard-event fields are what Signals/health use |
| **Reliable delivery + reconnect semantics** (route G): webhooks, REST backfill, disconnect/connect | Cheap devices that drop days of trips recreate handwriting risk in software | IMEI `…002` Jul 9–11 burst; without catch-up we under-bill or invent |
| **Device↔vehicle change events** (`vinChange`) or equivalent assignment support | Dongles move; paying for “VIN forever” without this corrupts invoices | IMEI `…003` Jul 17 cliff |
| **Raw event export / API we can store immutably** | Dispute email needs *our* ledger over vendor UI screenshots | Entire Part 2 design: `telemetry_raw` → decisions |

These are the features that justify leaving the bottom of the market. If a quote is cheap but missing trip odometer + metrics + reconnect/API, it is not cheap — it fails billing.

### Do not pay for (yet) — expensive SKUs that do not buy our pilot outcomes

| Capability | Why I would not pay in year-1 pilot | Caveat |
|---|---|---|
| **AI dual-facing dashcams** (+ often ~$40–55/mo on published gov add-ons, plus hardware) | Do not fix odometer provenance; do not appear in this feed; “who was driving” still needs a process (fob/app), not only a face video we are not staffed to review | Revisit if damage disputes dominate losses *and* we staff review |
| **Pretty fleet maps / coaching gamification** as the core SKU | Map theater does not write `mileage_decisions`; coaching is not an insurer filing | Fine as freebie; not a reason to 2× the contract |
| **ELD / IFTA / CMV compliance bundles** | Subscription cars are not a trucking compliance problem | Do not buy truck SKUs for a car pilot |
| **“Continuous geofence / stolen vehicle” premium tiers** that assume dense GPS | This feed’s `tripData` is sparse crumbs — paying for geofence theater without denser sampling is buying a checkbox | If plan-area abuse is real, pay for **dense GPS or parked-location check-ins**, not a marketing geofence on crumbs |
| **Vendor “driver score” as underwriting** | Black-box scores we cannot explain lose the renewal argument the same way handwriting loses overage | Prefer exportable hard-event rates we can defend; score in-house if needed |
| **Cabin / identity biometrics** | Not on the menu of this device class at any reasonable pilot price | Driver ID is a product decision (app unlock / fob), not a pricier dongle tier |

### The gap, in one sentence

**Worth paying for:** durable trip truth (odo + metrics + delivery + device moves) we can store and explain. **Not worth paying for (first):** cameras, coaching polish, compliance bundles, and geofence theater that do not change the overage email or the insurer conversation.

Aim the commercial quote at the **mid stack in §2** (~$25–40/mo SaaS class with gateway), not the tracker floor and not the cam-heavy ceiling — unless a later loss review proves damage/identity pays for cameras.

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
