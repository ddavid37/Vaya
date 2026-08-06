<!-- What we learned from living with feed.jsonl — Part 2 telemetry memo (≤ ~2 pages). -->

# Telemetry memo

Fifteen cars leave the lot for months. Three costs today: **(B) billing** overage from two handwritten odometer reads; **(I) insurance** one fleet rate because we cannot describe how anyone drives; **(O) ops blind spots** (who drove, when damage, car outside plan area). Sources: `data/feed.jsonl`, `data/seed.json` (NJ dealers), public pricing writeups in §2. **Guess** = not confirmed on a primary vendor quote.

---

## 1. Map what is actually possible

Ways to get data out of a car are **not** the same product at different prices.

| Route | Can deliver | Cannot deliver |
|---|---|---|
| **A. Human odo at handover/return** | Period clipboard miles | Trips, driver, damage time, location |
| **B. Dongle trip envelope** (`tripStart`/`tripEnd`, IMEI) | Start/end odometer, fuel, VIN when present | Who drove; stable car if dongle moves |
| **C. Vendor trip metrics** (`tripMetrics`) | `tripDistance`, hard brake/accel, idle, speeds | Location history; same as odometer when they disagree |
| **D. REST `trip` pull** | Catch-up trip shape | Often no VIN / thin odo |
| **E. Sparse GPS** (`tripData`) | A few lat/lon points | Continuous track or “outside plan for 3 weeks” |
| **F. MIL / battery** | Health flags | Miles or driving quality |
| **G. Delivery** (webhook/REST/disconnect) | When fragments arrived | New facts about the car |

**Unavailable at any price on this feed class:** authenticated driver, damage/condition clock, continuous geofence, guaranteed device↔VIN without assignment, one blended “true miles” (odo and `tripDistance` differ ~0.5–1.5 mi on clean trips — *read in feed*).

---

## 2. Cost it — 15 cars, first year

**Stack:** one gateway/car + platform for B+C+E, **no cameras**. Feed vendor unnamed → budget model, not a signed quote.

| Line | $/car/mo year-1 | Confirmed / Guess | Where the number came from |
|---|---|---|---|
| Platform SaaS | **$32** | **Guess** (band $25–40) | Reseller/commercial ranges in 2026 industry writeups; majors are quote-only on marketing sites |
| Gov list anchor (not our quote) | $39 VG license | **Confirmed** | Samsara Sourcewell-style cooperative sheet (LIC-VG-ENT) via published writeups |
| Hardware amortized | **~$10** ($125÷12) | **Guess** | Typical gateway ~$80–150 in reseller commentary |
| Install + swap contingency | **~$7** | **Guess** | Not on pricing pages; lot labor |
| Spares (2 units / 15) | **~$1** | **Guess** | Feed shows `vinChange` — need spares |
| Ops labor (reconnect/dispute) | **~$7** | **Guess** | ~2 hr/mo @ $50; pattern from IMEI `…002` delay, hours not measured |
| Our ingest/dispute tooling | **~$17** | **Guess** | Internal pilot eng+host ~$250/mo ÷ 15 |
| **Mid total** | **~$75 / car / mo** | Blended | **~$13.4k** fleet year-1 |
| Low / high (no cams) | ~$50 / ~$110 | Guess | SaaS+labor swing |

---

## 3. What is worth paying for

Cheap trackers and cam-heavy platforms differ by **several times per car**. For Vaya:

**Pay for:** trip odometer (B), trip metrics on same `transactionId` (C), reconnect/API so days are not lost (G), device-move events (`vinChange`), raw export we can store. These defend overage and start an insurance *conversation*.

**Do not pay for (year-1):** AI dashcams, coaching/map theater, ELD/IFTA truck bundles, geofence SKUs on sparse GPS, vendor black-box “driver score” as underwriting.

**Target quote:** mid SaaS (~$25–40/mo) + gateway — not the floor, not the cam ceiling.

---

## 4. Decide

**Recommendation: yes — instrument the 15-car pilot with a mid-tier gateway + API (routes B+C+G) now.** Of the three costs, we **attack billing**. We **leave insurance rate change and ops blind spots alone for now**.

| Cost | Stance |
|---|---|
| **Billing** | **Attack** — trip ledger + provenance so overage is not only handwriting |
| **Insurance** | **Leave alone for now** — hard-event exports only; no cams, no underwriting claim |
| **Ops blind spots** | **Leave alone for now** — driver / damage / geofence need data or process this feed does not give |

**Known gap (still recommend):** feed VINs have **0 overlap** with `seed.json` marketplace cars. We do **not** invent a subscriber link. Mid-tier still pays for itself as the **billing-evidence pipeline** on instrumented pilot cars; the full “this Google subscriber’s $252 email” waits on a real VIN↔subscription link later.

**What changes what people pay:** telemetry changes **evidence for miles**, not a new silent fee. Overage still follows plan `overagePerMile` × miles over allowance. **Where we operate: NJ / US** (`seed.json` dealers in Englewood, Hackensack, Paramus). We have **no subscriber T&Cs on file to cite** here — before go-live, counsel must put lawful mileage/telematics notice in the agreement. I am not a lawyer.

---

## 5. Prove before spending — close in a day (feed desk only)

**Biggest question:** can trip-bounded feed data defend an overage total better than one handwritten number?

**Cheapest close (no vendor call — only `feed.jsonl` + our rule):**

1. Pick **one IMEI** and a date window in the feed.  
2. For each trip: trust odometer delta when start/end are monotonic; else `tripDistance` (never average) — same as `lib/mileage.ts` / `/ops/disputes`.  
3. Sum trusted miles; write the short ops paragraph listing per-trip source + flags (e.g. `vinChange`, `METRICS_DELAYED`, TX-480041).  
4. **Pass:** paragraph is explainable trip-by-trip without inventing miles. **Fail:** you need blends, GPS fiction, or a seed join that is not in the files.

That settles “is the data shape worth buying mid-tier for?” in a day. Price confirmation is a later quote, not the blocker for this judgment.

---

## 6. One thing I refuse to build

**Refuse: averaging odometer delta with `tripDistance` into a single “smart miles” number** (and the cousin move: inventing trips or geofences from sparse `tripData`).

It looks reasonable on a slide and loses the first real dispute — the feed already shows the two inputs disagree. That is the hard refuse.

---

## Traceability (short)

| Fact | Source |
|---|---|
| Event types, `vinChange`, delay burst, TX-480041, sparse `tripData`, odo vs distance gap | `data/feed.jsonl` |
| Dealers NJ / US | `data/seed.json` |
| $39 VG gov list; commercial quote-only; $25–40 band | Public cooperative sheet / 2026 industry pricing writeups — **not** a Vaya vendor quote |
| $/car mid ~$75 year-1 | **Mostly Guess** (§2) |
| Subscriber T&Cs | **None on file** — not cited |
