# DB manipulations & decisions

Living log of every database change we make (migrations, seed transforms, manual fixes, quarantines).  
If it touches Postgres/Supabase data or schema, it goes here.

---

## 2026-08-05 — Marketplace schema migrate

**Action:** Applied Prisma migration `20260805190000_marketplace_init` to Supabase.

**Tables created:** `dealers`, `plans`, `vehicles`, `drivers`, `subscriptions`, `domain_events`, `ledger_entries`, `data_conflicts`.

**Index:** `subscriptions_one_live_per_vehicle` — unique on `vehicle_id` where `status IN ('RESERVED','ACTIVE','ENDING')`.

**Why:** Enforce one live commitment per vehicle at the database layer (see `DECISIONS.md`).

**Files:** `prisma/schema.prisma`, `prisma/migrations/20260805190000_marketplace_init/migration.sql`.

---

## 2026-08-05 — Seed load (`npm run db:seed`)

**Action:** Loaded `data/seed.json` into Supabase via `scripts/seed.ts`.

**Counts:** 3 dealers, 6 plans, 40 vehicles, 25 drivers, 26 subscriptions, 44 domain events.

### Quarantine: dual live subscription on `veh-004`

| | |
|---|---|
| **Whose fault?** | **Seed fixture**, not our app and not Supabase. The assignment file ships two `ACTIVE` subscriptions on one vehicle. |
| **Rows** | `sub-004` (driver `drv-004`, start `2026-02-12`) and `sub-026` (driver `drv-020`, start `2026-07-02`) both claimed `veh-004`. |
| **What we did** | Kept both rows. Set `sub-026.status = CONFLICTING`. Left `sub-004` as `ACTIVE`. |
| **Rule** | Earliest `startDate` wins (tie-break: `id` asc). |
| **Why before insert** | The partial unique index rejects two live rows; quarantine must happen at load time or the seed cannot apply. |
| **Audit** | Inserted `data_conflicts` row type `DUAL_LIVE_SUBSCRIPTION`, subjects `[sub-004, sub-026]`. |
| **How often?** | Once in this dataset. |

### Other conflict flags (no row rewrites)

Also wrote `data_conflicts` for:

- `VEHICLE_STATUS_MISMATCH` — `vehicles.status` vs live subscription set
- `PRICE_MISMATCH` — `plans.base_price` ≠ `subscriptions.monthly_price`
- `ODOMETER_IMPOSSIBILITY` — `start_odometer` > vehicle odometer

Source prices/statuses/odometers were **not** rewritten (except the dual-live status override above).

**Total conflict rows after seed:** 21 (including 1 dual-live).

**Re-run:** `npm run db:seed` (destructive reload of marketplace tables).

---

## Template for future entries

```md
## YYYY-MM-DD — short title

**Action:** what ran / who changed what
**Why:** decision rationale
**Before → After:** concrete row/schema delta
**Reversible?** how / command
```
