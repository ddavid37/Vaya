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

One dongle per car + software that sends trip data like our feed. **No cameras**. **All numbers below are assumed** for now.

**Headline:** ~**$75 / car / month** in year 1 → ~**$13.4k** for 15 cars. Low ~$50 / high ~$110 if SaaS and labor swing.

**Assumed: This are the prices that are assumed using the Cursor AI based on his used models and the relevant web retrievals. Final prices will be negotiated as well.**


| Line                        | $ per car per month | Confirmed / Assumed |
| --------------------------- | ------------------- | ------------------- |
| Software (SaaS)             | ~$32                | Assumed             |
| Dongle hardware             | ~$10                | Assumed             |
| Install / move at lot       | ~$7                 | Assumed             |
| Spare dongles (2 for fleet) | ~$1                 | Assumed             |
| Ops time (gaps, disputes)   | ~$7                 | Assumed             |
| Our ingest + dispute tools  | ~$17                | Assumed             |
| **Total**                   | **~$75**            | Assumed             |


Fleet year-1 (15 × $75 × 12): **~$13.4k**.

---

## 3. What is worth paying for

Cheap trackers and full platforms can cost **several times** different per car. Pricing pages don’t say which extras help Vaya. The rest is improves for the following years if they seemed to be relevant.

**Worth paying for** (helps defend overage / keep trip truth)

- Trip odometer start/end
- Trip metrics on the same trip (distance, hard brake/accel, idle, speeds)
- Reliable API / reconnect so missing days get caught up
- Device-move events (`vinChange`) so we don’t bill the wrong car
- Raw export we can store and show in a dispute
- FDE team to maintain integrations

**Not worth paying for yet**

- AI dashcams / cabin cameras
- Fancy map apps and “driver coaching” polish
- Truck compliance packs (ELD / IFTA)
- Premium geofence / “always tracking” GPS (our feed only has sparse crumbs, also for privacy)
- Body scanners (e.g. UVeye-style) before we can use damage timing in ops
- Vendor black-box “driver score” sold as insurance truth

**Buy the middle:** ~$25–40/mo software + dongle (the §2 budget) — not the cheapest pin-on-a-map tracker, not the cam + scanner stack.

---

## 4. Decision

**Buy now:** the middle stack from §2/§3 for the 15-car pilot (dongle + trip API — no scanners, no continuous fancy GPS).

**Attack now — billing**

- Replace “a number somebody typed” with trip miles + clear source per trip (immidiate - not require special resources.
- Same overage math as today (`overagePerMile` × miles over allowance) - to better confirm that charge.

**Leave alone for now**

- **Insurance** - keep hard-event exports; don’t claim a lower fleet rate or buy cams/scores for underwriting
- **Ops blind spots** - who drove, damage timing, outside plan area.

**Optional later (not year-1)**

- Body scanners (e.g. UVeye) — driver burden + high cost before we can use damage timing in ops
- Continuous GPS — may help safety/geofence later; sparse crumbs are not the same value, and always-on tracking hurts privacy

**True But not Relevant (doesn’t change the buy)**

- Feed VINs don’t match marketplace seed cars — we don’t invent that link (assignment / demo data)

---

## 5. Period Miles Number approaval - close in a day

**Biggest question I picked is** can we defend the period miles number so “you charged the wrong overage” mostly goes away?

1. At start and end of the covered period, ops reads the odometer (or one agreed reading at return).
2. Write start miles, end miles, miles used, allowance, overage miles, and `$` at `overagePerMile`.
3. Customer signs that they agree those miles for billing.

That is cheap, immediate, and likely eliminates most mileage-limit disputes (“a number somebody typed” with no ack).

---

## 6. Things I refuse to build

**Refuse (data integrity)**

- Creating new data - only place holders if needed.
- Geofence / “outside plan for weeks” from sparse `tripData` — crumbs are not continuous presence (fake certainty + overclaims location)
- Inventing trips from GPS crumbs — not real trips; expands location without clear notice (NJ / US)
- Continous GPS tracking to preserve drivers privacy

---



## Traceability (short)


| Fact                                                                                     | Source                                     |
| ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| Event types, `vinChange`, delay burst, TX-480041, sparse `tripData`, odo vs distance gap | `data/feed.jsonl`                          |
| Dealers NJ / US                                                                          | `data/seed.json`                           |
| $/car mid ~$75 year-1                                                                    | **All guesses** (§2) — no vendor quote yet |
| Subscriber T&Cs                                                                          | **None on file** — not cited               |


