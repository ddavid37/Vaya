<!-- What we learned from living with feed.jsonl — Part 2 telemetry memo (≤ ~2 pages). -->

# Telemetry memo

Fifteen cars leave the lot for months. Three costs today: **(B) billing** overage from two handwritten odometer reads; **(I) insurance** one fleet rate because we cannot describe how anyone drives; **(O) ops blind spots** (who drove, when damage, car outside plan area). Source for everything below: `data/feed.jsonl`, `data/seed.json` (dealers in NJ), public vendor price sheets/writeups noted in §2. **Guess** = not confirmed on a primary quote.

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

**Recommendation: instrument the 15-car pilot with a mid-tier gateway + API (routes B+C+G), and attack billing first.**

| Cost | Stance |
|---|---|
| **Billing (B)** | **Attack now** — trip ledger + provenance replaces “a number somebody typed” for overage disputes |
| **Insurance (I)** | **Leave rate change alone for now** — keep hard-event exports; do not buy cams or claim underwriting |
| **Ops blind spots (O)** | **Leave alone for now** — driver/damage/geofence are unavailable or need denser GPS + process we do not have |

**What changes what people pay:** overage still uses plan `overagePerMile` and period miles; telemetry changes **evidence**, not a silent new fee. Subscription T&Cs must already allow mileage measurement and billing from recorded odometer/trip data (and notice/consent for location if we later use GPS). **Assumption:** we operate where seed dealers are — **NJ / US** (`seed.json` cities Englewood, Hackensack, Paramus). Confirm counsel on NJ/US consumer + telematics disclosure before go-live; I am not a lawyer.

**Not “do nothing”:** handwriting-only fails the brief’s dispute story. **Not “full platform”:** cameras and geofence theater do not buy billing defense.

---

## 5. Prove before spending — close in a day

**Biggest question:** can mid-tier trip data defend one overage number better than handwriting?

**Cheapest one-day close:**

1. Morning: get a **written quote** for 15 gateways (SaaS + hardware + install + API/webhook) — replaces Guess SaaS/hardware.  
2. Same day: pick **one IMEI** in `feed.jsonl`, sum trusted miles with our rule (odo when monotonic, else `tripDistance`), and write the dispute paragraph ops would send — compare to a single handwritten period total.  
3. If quote ≤ ~$40/car/mo SaaS and the paragraph is explainable trip-by-trip → buy mid-tier. If API/raw export missing or miles not trip-bounded → walk away.

---

## 6. One thing I refuse to build

**Refuse: a “smart miles” blend that averages odometer delta with `tripDistance` (or invents trips/geofences from sparse `tripData`).**

It looks fair on a pricing slide and loses the first real dispute. Other candidates I also will not build yet: VIN↔subscription fiction across feed/seed with 0 overlap; selling our composite driving-health score as insurer truth.

---

## Traceability (short)

| Fact | Source |
|---|---|
| Event types, `vinChange`, delay burst, TX-480041, sparse `tripData` | `data/feed.jsonl` |
| Dealers NJ | `data/seed.json` |
| $39 VG gov list; commercial quote-only; $25–40 band | Public cooperative sheet / 2026 industry pricing writeups — **not** a Vaya vendor quote |
| $/car mid ~$75 year-1 | **Mostly Guess** (§2) |
