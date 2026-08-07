# Telemetry memo

Fifteen cars leave the lot for months. Three costs today: **(B) billing** overage from two handwritten odometer reads; **(I) insurance** one fleet rate because we cannot describe how anyone drives; **(O) ops blind spots** (who drove, when damage, car outside plan area). Sources: `data/feed.jsonl`, `data/seed.json` (NJ dealers). Cost numbers in §2 are **all guesses** for now.

---

## 1. Map what is actually currently possible to record and what is not

From `data/feed.jsonl` as it stands (dongle/IMEI stream — not handwriting, not cameras).

**Currently possible**

- Trip start/end with odometer (when present) and fuel
- Distance + behavior: `tripDistance`, hard brake/accel, idle, avg/max speed
- Period miles with provenance (pick odo **or** `tripDistance` per trip
- Device≠vehicle handling via `vinChange` event from the given data
- Catch-up after gaps (REST `trip`, delayed `tripMetrics`)
- pickup/return (if there is) location - recorded manualy by the represenative.

**Currently not possible**

- Who was driving
- Drivers insurance records
- chagne in car condition (comparing the car scanning at the beginning vs return)
- When damage happened during the holding period
- Continuous location / (eg. “sat outside plan area for weeks”) (no active GPS tracking)
- Treating feed cars as the same cars as the marketplace seed (VINs don’t match)

---

## 2. Cost it — 15 cars, first year

One dongle per car + software that sends trip data like our feed. **No cameras.** Not a signed quote — a budget. **All numbers below are guesses** for now.

**Headline:** ~**$75 / car / month** in year 1 → ~**$13.4k** for 15 cars. Low ~$50 / high ~$110 if SaaS and labor swing.


| Line | $ per car per month | Confirmed / Guess |
| --- | --- | --- |
| Software (SaaS) | ~$32 | Guess |
| Dongle hardware ($125÷12) | ~$10 | Guess |
| Install / move at lot | ~$7 | Guess |
| Spare dongles (2 for fleet) | ~$1 | Guess |
| Ops time (gaps, disputes) | ~$7 | Guess |
| Our ingest + dispute tools | ~$17 | Guess |
| **Total** | **~$75** | Guess |


Fleet year-1 (15 × $75 × 12): **~$13.4k**.

---

## 3. What is worth paying for

Cheap trackers and cam-heavy platforms differ by **several times per car**. For Vaya:

**Pay for:** trip odometer (B), trip metrics on same `transactionId` (C), reconnect/API so days are not lost (G), device-move events (`vinChange`), raw export we can store. These defend overage and start an insurance *conversation*.

**Do not pay for (year-1):** AI dashcams, coaching/map theater, ELD/IFTA truck bundles, geofence SKUs on sparse GPS, vendor black-box “driver score” as underwriting.

**Target quote:** mid SaaS (~$25–40/mo) + gateway — not the floor, not the cam ceiling.

---

## 4. Decide

**Recommendation: yes — instrument the 15-car pilot with a mid-tier gateway + API (routes B+C+G) now.** Of the three costs, we **attack billing**. We **leave insurance rate change and ops blind spots alone for now**.


| Cost                | Stance                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| **Billing**         | **Attack** — trip ledger + provenance so overage is not only handwriting                          |
| **Insurance**       | **Leave alone for now** — hard-event exports only; no cams, no underwriting claim                 |
| **Ops blind spots** | **Leave alone for now** — driver / damage / geofence need data or process this feed does not give |


**Known gap (still recommend):** feed VINs have **0 overlap** with `seed.json` marketplace cars. We do **not** invent a subscriber link. Mid-tier still pays for itself as the **billing-evidence pipeline** on instrumented pilot cars; the full “this Google subscriber’s $252 email” waits on a real VIN↔subscription link later.

**What changes what people pay:** telemetry changes **evidence for miles**, not a new silent fee. Overage still follows plan `overagePerMile` × miles over allowance. **Where we operate: NJ / US** (`seed.json` dealers in Englewood, Hackensack, Paramus). We have **no subscriber T&Cs on file to cite** here — before go-live, counsel must put lawful mileage/telematics notice in the agreement. I am not a lawyer.

---

## 5. Prove before spending — close in a day (feed desk only)

**Biggest question:** can trip-bounded feed data defend an overage total better than one handwritten number?

**Cheapest close (no vendor call — only** `feed.jsonl` **+ our rule):**

1. Pick **one IMEI** and a date window in the feed.
2. For each trip: trust odometer delta when start/end are monotonic; else `tripDistance` (never average) — same as `lib/mileage.ts` / `/ops/disputes`.
3. Sum trusted miles; write the short ops paragraph listing per-trip source + flags (e.g. `vinChange`, `METRICS_DELAYED`, TX-480041).
4. **Pass:** paragraph is explainable trip-by-trip without inventing miles. **Fail:** you need blends, GPS fiction, or a seed join that is not in the files.

That settles “is the data shape worth buying mid-tier for?” in a day. Price confirmation is a later quote, not the blocker for this judgment.

---

## 6. Things I refuse to build

**Primary refuse — data integrity:** averaging odometer delta with `tripDistance` into one “smart miles” number. The feed gives two disagreeing estimates; blending invents a third. Pick one source per trip, record the discard — or bill nothing.

**Also refuse — integrity + privacy (location):**

1. **Geofence / “outside plan area for weeks” from sparse** `tripData`**.** A handful of GPS crumbs are not continuous presence. Shipping that alert fabricates certainty (**data integrity**) and treats thin location samples like ongoing tracking of where someone lives/parks — a use we should not imply without clear notice and a lawful basis under **NJ/US** privacy expectations for location data (**privacy**). Store crumbs raw; do not productize the story.
2. **Inventing trips from GPS crumbs.** Turning breadcrumbs into billing/ops “trips” invents events that were never delivered as trips (**data integrity**) and expands location into a movement history the subscriber was not clearly signed up for (**privacy**). Trips come from `tripStart`/`tripEnd`/`tripMetrics` (and REST `trip`), not from `tripData`.

Why these: each looks useful on a slide and fails the first dispute — or overclaims location in a way we cannot defend.

---

## Traceability (short)


| Fact                                                                                     | Source                                     |
| ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| Event types, `vinChange`, delay burst, TX-480041, sparse `tripData`, odo vs distance gap | `data/feed.jsonl`                          |
| Dealers NJ / US                                                                          | `data/seed.json`                           |
| $/car mid ~$75 year-1                                                                    | **All guesses** (§2) — no vendor quote yet |
| Subscriber T&Cs                                                                          | **None on file** — not cited               |


