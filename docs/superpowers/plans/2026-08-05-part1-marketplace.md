# Part 1 Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Part 1 marketplace + ops console: seed-loaded fleet, concurrent-safe subscription commits, early-end ledger, and conflict quarantine.

**Architecture:** Next.js App Router talks to in-process domain services over Prisma/Postgres. Live commitment is enforced by `SELECT … FOR UPDATE` on the vehicle row plus a partial unique index on live subscription statuses. Seed loads as-is; dual-live and status/price/odometer mismatches become `DataConflict` rows (and `CONFLICTING` subscriptions), never silent deletes.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Prisma 6, Postgres 16 (Docker Compose), Node 20+.

## Global Constraints

- OS target: Linux (README must state this); develop on macOS/Docker is fine.
- Fixtures: load `data/seed.json` as-is; do not hand-clean.
- Billing price = `subscription.monthlyPrice`, never `plans.basePrice` for charges.
- Bookability = no live sub in `{RESERVED,ACTIVE,ENDING}` AND `vehicle.status !== PENDING_INTAKE`.
- No auth, payments, or Part 2 telemetry in this plan.
- Two-command demo: `npm run setup` then `npm run dev`.
- Branch: `cursor/build`.

---

## File structure

```
docker-compose.yml
prisma/schema.prisma
prisma/migrations/.../migration.sql
prisma/seed.ts
src/lib/prisma.ts
src/lib/money.ts
src/domain/commitment.ts          # create + early-end + live helpers
src/domain/seed-load.ts           # insert + conflict detection (used by prisma/seed.ts)
src/domain/ledger.ts              # early-end ledger lines
src/app/layout.tsx
src/app/page.tsx                  # marketplace
src/app/ops/page.tsx              # fleet
src/app/ops/conflicts/page.tsx
src/app/api/subscriptions/route.ts
src/app/api/subscriptions/[id]/early-end/route.ts
scripts/setup.sh
scripts/test-invariant.ts
package.json
README.md
.env.example
```

---

### Task 1: Scaffold Next.js + Postgres + Prisma wiring

**Files:**
- Create: `docker-compose.yml`, `.env`, `.env.example`, `scripts/setup.sh`
- Create: `src/lib/prisma.ts`
- Modify: `package.json`, `.gitignore`, `README.md`
- Scaffold: Next.js app at repo root (App Router, TS, Tailwind, `src/`)

**Interfaces:**
- Produces: `prisma` singleton; `DATABASE_URL`; `npm run setup` / `npm run dev` stubs; Docker Postgres on `5432`

- [ ] **Step 1: Scaffold Next.js in the repo root**

Run from `/Users/david/Desktop/Vaya` (non-interactive). Keep existing `data/`, `docs/`, `DECISIONS.md`, `PLAN.md`, `README.md`.

```bash
npx create-next-app@15 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack false
```

If create-next-app refuses a non-empty directory, scaffold into a temp dir and move `package.json`, `src/`, `next.config.*`, `tsconfig.json`, `postcss.config.*`, `eslint.config.*` into the root, merging carefully so `data/` and docs stay.

- [ ] **Step 2: Add Docker Compose Postgres**

Create `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: vaya
      POSTGRES_PASSWORD: vaya
      POSTGRES_DB: vaya
    ports:
      - "5432:5432"
    volumes:
      - vaya_pg:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vaya -d vaya"]
      interval: 2s
      timeout: 5s
      retries: 15

volumes:
  vaya_pg:
```

Create `.env` and `.env.example`:

```
DATABASE_URL="postgresql://vaya:vaya@localhost:5432/vaya?schema=public"
```

Ensure `.gitignore` includes `.env`, `node_modules/`, `.next/`.

- [ ] **Step 3: Install Prisma and create client helper**

```bash
npm install @prisma/client
npm install -D prisma tsx
npx prisma init
```

Create `src/lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 4: Wire package scripts and setup shell**

In `package.json` scripts:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "setup": "bash scripts/setup.sh",
  "db:migrate": "prisma migrate deploy",
  "db:seed": "tsx prisma/seed.ts",
  "test:invariant": "tsx scripts/test-invariant.ts"
}
```

Create `scripts/setup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
npm install
docker compose up -d db
echo "Waiting for Postgres..."
until docker compose exec -T db pg_isready -U vaya -d vaya >/dev/null 2>&1; do sleep 1; done
npx prisma migrate deploy
npm run db:seed
echo "Setup complete. Run: npm run dev"
```

```bash
chmod +x scripts/setup.sh
```

Update `README.md` Status/Intended run to match setup + Part 1 in progress (keep short).

- [ ] **Step 5: Smoke-check Docker**

```bash
docker compose up -d db
docker compose exec -T db pg_isready -U vaya -d vaya
```

Expected: `accepting connections`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with Postgres and Prisma wiring"
```

---

### Task 2: Marketplace Prisma schema + partial unique index

**Files:**
- Create: `prisma/schema.prisma` (full replace of init stub)
- Create: migration via `prisma migrate dev`
- Test: `prisma/migrations/**/migration.sql` contains partial unique index

**Interfaces:**
- Produces: Prisma models `Dealer`, `Plan`, `Vehicle`, `Driver`, `Subscription`, `DomainEvent`, `LedgerEntry`, `DataConflict` and enums matching seed values (plus `SubscriptionStatus.CONFLICTING`)

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum VehicleStatus {
  AVAILABLE
  SUBSCRIBED
  RESERVED
  PENDING_INTAKE
}

enum SubscriptionStatus {
  RESERVED
  ACTIVE
  ENDING
  ENDED
  CONFLICTING
}

enum LedgerEntryType {
  PERIOD_BASE
  MILES_INCLUDED
  MILES_USED
  OVERAGE
  PRORATION
}

enum ConflictType {
  DUAL_LIVE_SUBSCRIPTION
  VEHICLE_STATUS_MISMATCH
  PRICE_MISMATCH
  ODOMETER_IMPOSSIBILITY
}

model Dealer {
  id        String    @id
  name      String
  city      String
  state     String
  joinedAt  DateTime  @db.Date
  vehicles  Vehicle[]
}

model Plan {
  id               String         @id
  name             String
  tier             String
  monthlyMiles     Int
  overagePerMile   Decimal        @db.Decimal(10, 2)
  basePrice        Decimal        @db.Decimal(10, 2)
  subscriptions    Subscription[]
}

model Vehicle {
  id           String        @id
  vin          String        @unique
  dealerId     String
  dealer       Dealer        @relation(fields: [dealerId], references: [id])
  year         Int
  make         String
  model        String
  trim         String
  color        String
  odometer     Int
  status       VehicleStatus
  monthlyPrice Decimal?      @db.Decimal(10, 2)
  listedAt     DateTime      @db.Date
  subscriptions Subscription[]
}

model Driver {
  id           String         @id
  email        String
  firstName    String
  lastName     String
  phone        String?
  licenseState String
  createdAt    DateTime       @db.Date
  subscriptions Subscription[]
}

model Subscription {
  id                   String             @id
  driverId             String
  driver               Driver             @relation(fields: [driverId], references: [id])
  vehicleId            String
  vehicle              Vehicle            @relation(fields: [vehicleId], references: [id])
  planId               String
  plan                 Plan               @relation(fields: [planId], references: [id])
  status               SubscriptionStatus
  monthlyPrice         Decimal            @db.Decimal(10, 2)
  startDate            DateTime           @db.Date
  endDate              DateTime?          @db.Date
  billingPeriodStart   DateTime?          @db.Date
  billingPeriodEnd     DateTime?          @db.Date
  startOdometer        Int
  milesThisPeriod      Int
  cancelledAt          DateTime?
  previousPlanId       String?
  previousMonthlyPrice Decimal?           @db.Decimal(10, 2)
  ledgerEntries        LedgerEntry[]

  @@index([vehicleId, status])
  @@index([driverId])
}

model DomainEvent {
  id          String   @id
  at          DateTime
  type        String
  subjectType String
  subjectId   String
  data        Json

  @@index([subjectType, subjectId])
  @@index([at])
}

model LedgerEntry {
  id             String          @id @default(cuid())
  subscriptionId String
  subscription   Subscription    @relation(fields: [subscriptionId], references: [id])
  type           LedgerEntryType
  amount         Decimal         @db.Decimal(10, 2)
  quantity       Decimal?        @db.Decimal(12, 3)
  unit           String?
  explanation    String
  createdAt      DateTime        @default(now())

  @@index([subscriptionId])
}

model DataConflict {
  id          String       @id @default(cuid())
  type        ConflictType
  subjectType String
  subjectIds  String[]
  resolution  String
  rationale   String
  createdAt   DateTime     @default(now())
}
```

- [ ] **Step 2: Create migration with partial unique index**

```bash
npx prisma migrate dev --name marketplace_init --create-only
```

Edit the generated `prisma/migrations/*/migration.sql` and **append**:

```sql
CREATE UNIQUE INDEX subscriptions_one_live_per_vehicle
ON subscriptions (vehicle_id)
WHERE status IN ('RESERVED', 'ACTIVE', 'ENDING');
```

Then apply:

```bash
npx prisma migrate dev
```

- [ ] **Step 3: Verify index exists**

```bash
docker compose exec -T db psql -U vaya -d vaya -c "\d+ subscriptions"
```

Expected: index `subscriptions_one_live_per_vehicle` listed.

- [ ] **Step 4: Commit**

```bash
git add prisma package.json package-lock.json
git commit -m "Add marketplace Prisma schema and live-subscription unique index"
```

---

### Task 3: Seed loader with conflict quarantine

**Files:**
- Create: `src/domain/seed-load.ts`
- Create: `prisma/seed.ts`
- Modify: `package.json` (`prisma.seed` config)

**Interfaces:**
- Consumes: `data/seed.json`; Prisma models from Task 2
- Produces: `loadSeed(prisma): Promise<{ conflicts: number; quarantined: string[] }>`
- Quarantine rule: for vehicle with multiple live seed subs, keep earliest `startDate` (tie-break: `id` asc); set losers to `CONFLICTING`; insert `DataConflict` type `DUAL_LIVE_SUBSCRIPTION`. Known case: `veh-004` → winner `sub-004`, loser `sub-026`.

- [ ] **Step 1: Write seed insert + detection in `src/domain/seed-load.ts`**

```ts
import { PrismaClient, Prisma, SubscriptionStatus, VehicleStatus, ConflictType } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type SeedFile = {
  dealers: Array<{ id: string; name: string; city: string; state: string; joinedAt: string }>;
  plans: Array<{
    id: string; name: string; tier: string; monthlyMiles: number;
    overagePerMile: number; basePrice: number;
  }>;
  vehicles: Array<{
    id: string; vin: string; dealerId: string; year: number; make: string; model: string;
    trim: string; color: string; odometer: number; status: string;
    monthlyPrice: number | null; listedAt: string;
  }>;
  drivers: Array<{
    id: string; email: string; firstName: string; lastName: string;
    phone: string | null; licenseState: string; createdAt: string;
  }>;
  subscriptions: Array<{
    id: string; driverId: string; vehicleId: string; planId: string; status: string;
    monthlyPrice: number; startDate: string; endDate: string | null;
    billingPeriodStart: string | null; billingPeriodEnd: string | null;
    startOdometer: number; milesThisPeriod: number;
    cancelledAt?: string; previousPlanId?: string; previousMonthlyPrice?: number;
  }>;
  events: Array<{
    id: string; at: string; type: string; subjectType: string; subjectId: string;
    data: Record<string, unknown>;
  }>;
};

const LIVE: SubscriptionStatus[] = [
  SubscriptionStatus.RESERVED,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.ENDING,
];

function dateOnly(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export async function loadSeed(prisma: PrismaClient) {
  const raw = readFileSync(resolve(process.cwd(), "data/seed.json"), "utf8");
  const seed = JSON.parse(raw) as SeedFile;

  await prisma.$transaction(async (tx) => {
    await tx.ledgerEntry.deleteMany();
    await tx.dataConflict.deleteMany();
    await tx.domainEvent.deleteMany();
    await tx.subscription.deleteMany();
    await tx.vehicle.deleteMany();
    await tx.driver.deleteMany();
    await tx.plan.deleteMany();
    await tx.dealer.deleteMany();

    await tx.dealer.createMany({
      data: seed.dealers.map((d) => ({ ...d, joinedAt: dateOnly(d.joinedAt) })),
    });
    await tx.plan.createMany({
      data: seed.plans.map((p) => ({
        ...p,
        overagePerMile: new Prisma.Decimal(p.overagePerMile),
        basePrice: new Prisma.Decimal(p.basePrice),
      })),
    });
    await tx.driver.createMany({
      data: seed.drivers.map((d) => ({ ...d, createdAt: dateOnly(d.createdAt) })),
    });
    await tx.vehicle.createMany({
      data: seed.vehicles.map((v) => ({
        ...v,
        status: v.status as VehicleStatus,
        monthlyPrice: v.monthlyPrice == null ? null : new Prisma.Decimal(v.monthlyPrice),
        listedAt: dateOnly(v.listedAt),
      })),
    });
    await tx.subscription.createMany({
      data: seed.subscriptions.map((s) => ({
        id: s.id,
        driverId: s.driverId,
        vehicleId: s.vehicleId,
        planId: s.planId,
        status: s.status as SubscriptionStatus,
        monthlyPrice: new Prisma.Decimal(s.monthlyPrice),
        startDate: dateOnly(s.startDate),
        endDate: s.endDate ? dateOnly(s.endDate) : null,
        billingPeriodStart: s.billingPeriodStart ? dateOnly(s.billingPeriodStart) : null,
        billingPeriodEnd: s.billingPeriodEnd ? dateOnly(s.billingPeriodEnd) : null,
        startOdometer: s.startOdometer,
        milesThisPeriod: s.milesThisPeriod,
        cancelledAt: s.cancelledAt ? new Date(s.cancelledAt) : null,
        previousPlanId: s.previousPlanId ?? null,
        previousMonthlyPrice:
          s.previousMonthlyPrice == null ? null : new Prisma.Decimal(s.previousMonthlyPrice),
      })),
    });
    await tx.domainEvent.createMany({
      data: seed.events.map((e) => ({
        id: e.id,
        at: new Date(e.at),
        type: e.type,
        subjectType: e.subjectType,
        subjectId: e.subjectId,
        data: e.data as Prisma.InputJsonValue,
      })),
    });
  });

  const quarantined: string[] = [];
  const liveSubs = await prisma.subscription.findMany({
    where: { status: { in: LIVE } },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  const byVehicle = new Map<string, typeof liveSubs>();
  for (const sub of liveSubs) {
    const list = byVehicle.get(sub.vehicleId) ?? [];
    list.push(sub);
    byVehicle.set(sub.vehicleId, list);
  }

  for (const [vehicleId, subs] of byVehicle) {
    if (subs.length < 2) continue;
    const [, ...losers] = subs;
    for (const loser of losers) {
      await prisma.subscription.update({
        where: { id: loser.id },
        data: { status: SubscriptionStatus.CONFLICTING },
      });
      quarantined.push(loser.id);
      await prisma.dataConflict.create({
        data: {
          type: ConflictType.DUAL_LIVE_SUBSCRIPTION,
          subjectType: "subscription",
          subjectIds: [subs[0].id, loser.id],
          resolution: `Kept ${subs[0].id} live; quarantined ${loser.id} as CONFLICTING`,
          rationale:
            "Partial unique live-commitment invariant: earliest startDate wins; seed dual-ACTIVE preserved as visible quarantine.",
        },
      });
    }
  }

  // Status mismatch, price mismatch, odometer flags (create DataConflict only; do not rewrite rows)
  const vehicles = await prisma.vehicle.findMany({ include: { subscriptions: true } });
  const plans = new Map((await prisma.plan.findMany()).map((p) => [p.id, p]));

  for (const v of vehicles) {
    const live = v.subscriptions.filter((s) => LIVE.includes(s.status));
    const hasLive = live.length > 0;
    const statusSaysTaken =
      v.status === VehicleStatus.SUBSCRIBED || v.status === VehicleStatus.RESERVED;
    if (hasLive !== statusSaysTaken && v.status !== VehicleStatus.PENDING_INTAKE) {
      // ENDING still occupies; SUBSCRIBED without live or AVAILABLE with live are mismatches
      if ((hasLive && v.status === VehicleStatus.AVAILABLE) || (!hasLive && statusSaysTaken)) {
        await prisma.dataConflict.create({
          data: {
            type: ConflictType.VEHICLE_STATUS_MISMATCH,
            subjectType: "vehicle",
            subjectIds: [v.id, ...live.map((s) => s.id)],
            resolution: "Left vehicle.status unchanged; marketplace uses live subscription set",
            rationale: `vehicle.status=${v.status} but liveCount=${live.length}`,
          },
        });
      }
    }
    for (const s of v.subscriptions) {
      const plan = plans.get(s.planId);
      if (plan && !plan.basePrice.equals(s.monthlyPrice)) {
        await prisma.dataConflict.create({
          data: {
            type: ConflictType.PRICE_MISMATCH,
            subjectType: "subscription",
            subjectIds: [s.id, s.planId],
            resolution: "Billing uses subscription.monthlyPrice; catalog basePrice untouched",
            rationale: `plan.basePrice=${plan.basePrice} vs subscription.monthlyPrice=${s.monthlyPrice}`,
          },
        });
      }
      if (s.startOdometer > v.odometer) {
        await prisma.dataConflict.create({
          data: {
            type: ConflictType.ODOMETER_IMPOSSIBILITY,
            subjectType: "subscription",
            subjectIds: [s.id, v.id],
            resolution: "Left both values as-is",
            rationale: `startOdometer ${s.startOdometer} > vehicle.odometer ${v.odometer}`,
          },
        });
      }
    }
  }

  return { conflicts: await prisma.dataConflict.count(), quarantined };
}
```

- [ ] **Step 2: Wire `prisma/seed.ts`**

```ts
import { PrismaClient } from "@prisma/client";
import { loadSeed } from "../src/domain/seed-load";

const prisma = new PrismaClient();

async function main() {
  const result = await loadSeed(prisma);
  console.log(
    `Seeded. conflicts=${result.conflicts} quarantined=${result.quarantined.join(",") || "(none)"}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Add to `package.json`:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 3: Run seed and assert quarantine**

```bash
npm run db:seed
docker compose exec -T db psql -U vaya -d vaya -c "SELECT id, status FROM subscriptions WHERE vehicle_id='veh-004' ORDER BY id;"
docker compose exec -T db psql -U vaya -d vaya -c "SELECT type, resolution FROM data_conflicts WHERE type='DUAL_LIVE_SUBSCRIPTION';"
```

Expected: `sub-004` ACTIVE, `sub-026` CONFLICTING; at least one `DUAL_LIVE_SUBSCRIPTION` row.

- [ ] **Step 4: Commit**

```bash
git add src/domain/seed-load.ts prisma/seed.ts package.json
git commit -m "Load seed as-is with dual-live quarantine and conflict rows"
```

---

### Task 4: Commitment service + create subscription API

**Files:**
- Create: `src/domain/commitment.ts`
- Create: `src/app/api/subscriptions/route.ts`
- Create: `scripts/test-invariant.ts` (minimal failing first — full asserts in Task 8; here add create helper test via script after API exists)

**Interfaces:**
- Consumes: Prisma; live index from Task 2
- Produces:
  - `createSubscription(input: { driverId: string; vehicleId: string; planId: string }): Promise<{ id: string }>`
  - Throws / maps `P2002` → error with `code: "VEHICLE_NOT_AVAILABLE"`
  - `POST /api/subscriptions` body `{ driverId, vehicleId, planId }` → `201` `{ id }` or `409` `{ code, message }`

- [ ] **Step 1: Implement `src/domain/commitment.ts` create path**

```ts
import {
  Prisma,
  PrismaClient,
  SubscriptionStatus,
  VehicleStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";

export class CommitmentError extends Error {
  constructor(
    public code: "VEHICLE_NOT_AVAILABLE" | "VEHICLE_NOT_BOOKABLE" | "NOT_FOUND" | "INVALID_STATE",
    message: string,
  ) {
    super(message);
    this.name = "CommitmentError";
  }
}

export async function createSubscription(
  prisma: PrismaClient,
  input: { driverId: string; vehicleId: string; planId: string },
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const vehicle = await tx.$queryRaw<Array<{ id: string; status: VehicleStatus }>>`
        SELECT id, status FROM vehicles WHERE id = ${input.vehicleId} FOR UPDATE
      `;
      if (!vehicle[0]) throw new CommitmentError("NOT_FOUND", "Vehicle not found");
      if (vehicle[0].status === VehicleStatus.PENDING_INTAKE) {
        throw new CommitmentError("VEHICLE_NOT_BOOKABLE", "Vehicle pending intake");
      }

      const plan = await tx.plan.findUnique({ where: { id: input.planId } });
      if (!plan) throw new CommitmentError("NOT_FOUND", "Plan not found");
      const driver = await tx.driver.findUnique({ where: { id: input.driverId } });
      if (!driver) throw new CommitmentError("NOT_FOUND", "Driver not found");

      const id = `sub-${randomUUID().slice(0, 8)}`;
      const today = new Date();
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      const periodEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));

      const sub = await tx.subscription.create({
        data: {
          id,
          driverId: input.driverId,
          vehicleId: input.vehicleId,
          planId: input.planId,
          status: SubscriptionStatus.ACTIVE,
          monthlyPrice: plan.basePrice,
          startDate: start,
          endDate: null,
          billingPeriodStart: start,
          billingPeriodEnd: periodEnd,
          startOdometer: (
            await tx.vehicle.findUniqueOrThrow({ where: { id: input.vehicleId } })
          ).odometer,
          milesThisPeriod: 0,
        },
      });

      await tx.domainEvent.create({
        data: {
          id: `evt-${randomUUID().slice(0, 8)}`,
          at: new Date(),
          type: "subscription.started",
          subjectType: "subscription",
          subjectId: sub.id,
          data: { vehicleId: input.vehicleId, driverId: input.driverId, planId: input.planId },
        },
      });

      await tx.vehicle.update({
        where: { id: input.vehicleId },
        data: { status: VehicleStatus.SUBSCRIBED },
      });

      return { id: sub.id };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new CommitmentError("VEHICLE_NOT_AVAILABLE", "Vehicle already has a live commitment");
    }
    throw e;
  }
}
```

- [ ] **Step 2: Implement `POST /api/subscriptions`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CommitmentError, createSubscription } from "@/domain/commitment";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    driverId?: string;
    vehicleId?: string;
    planId?: string;
  };
  if (!body.driverId || !body.vehicleId || !body.planId) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Missing fields" }, { status: 400 });
  }
  try {
    const result = await createSubscription(prisma, {
      driverId: body.driverId,
      vehicleId: body.vehicleId,
      planId: body.planId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof CommitmentError) {
      const status =
        e.code === "VEHICLE_NOT_AVAILABLE" ? 409 : e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ code: e.code, message: e.message }, { status });
    }
    console.error(e);
    return NextResponse.json({ code: "INTERNAL", message: "Unexpected error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Manual happy-path check**

Pick a bookable vehicle (no live sub). Example after seed:

```bash
npm run dev
# separate terminal:
curl -s -X POST http://localhost:3000/api/subscriptions \
  -H 'content-type: application/json' \
  -d '{"driverId":"drv-002","vehicleId":"veh-020","planId":"plan-local-core"}'
```

Expected: `201` with `{ "id": "sub-..." }`. Second identical POST → `409` `VEHICLE_NOT_AVAILABLE` (adjust vehicle id if `veh-020` is taken — query bookable first).

- [ ] **Step 4: Commit**

```bash
git add src/domain/commitment.ts src/app/api/subscriptions/route.ts
git commit -m "Add concurrent-safe subscription commit API"
```

---

### Task 5: Marketplace UI (`/`)

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/app/globals.css` tweaks only if needed
- Create: `src/components/CommitForm.tsx` (client)

**Interfaces:**
- Consumes: Prisma vehicle/plan queries; `POST /api/subscriptions`
- Produces: Server-rendered list of bookable vehicles; client form posts commit

- [ ] **Step 1: Query helpers on the page**

In `src/app/page.tsx` (server component): load vehicles with `subscriptions` where status in live set; filter bookable; load plans + a default driver (`drv-002` if they have no live sub, else first driver without live sub).

```ts
const LIVE = ["RESERVED", "ACTIVE", "ENDING"] as const;

const vehicles = await prisma.vehicle.findMany({
  include: { dealer: true, subscriptions: { where: { status: { in: [...LIVE] } } } },
  orderBy: { id: "asc" },
});
const bookable = vehicles.filter(
  (v) => v.status !== "PENDING_INTAKE" && v.subscriptions.length === 0,
);
const plans = await prisma.plan.findMany({ orderBy: { basePrice: "asc" } });
```

- [ ] **Step 2: Build simple marketplace UI**

- Heading: Vaya
- One short line of support copy
- Table/list: make/model/year, dealer city, listed monthlyPrice, VIN tail
- Per row: plan `<select>` + Commit button (client component posting JSON)
- Show success id or 409 message inline
- Nav link to `/ops`

Keep styling utilitarian (Tailwind). Do not build a marketing landing page.

- [ ] **Step 3: Verify in browser**

```bash
npm run setup && npm run dev
```

Open `http://localhost:3000` — bookable cars visible (non-empty). Commit one; row disappears / shows taken after refresh.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx src/components/CommitForm.tsx
git commit -m "Add driver marketplace browse and commit UI"
```

---

### Task 6: Ops fleet + conflicts pages

**Files:**
- Create: `src/app/ops/page.tsx`
- Create: `src/app/ops/conflicts/page.tsx`
- Modify: `src/app/layout.tsx` nav if needed

**Interfaces:**
- Consumes: vehicles + live subs + `dataConflict` counts by vehicle/subjectIds
- Produces: `/ops` fleet table; `/ops/conflicts` list

- [ ] **Step 1: Fleet page**

Columns: vehicle id, VIN, status (row), derived live state (`FREE` | live sub status), live sub id, driver name, conflict badge if any `subjectIds` contains vehicle or its sub ids.

- [ ] **Step 2: Conflicts page**

Table: type, subjectIds, resolution, rationale, createdAt. Must show `DUAL_LIVE_SUBSCRIPTION` for `sub-004`/`sub-026` after seed.

- [ ] **Step 3: Verify**

Open `/ops` and `/ops/conflicts` — both non-empty after seed.

- [ ] **Step 4: Commit**

```bash
git add src/app/ops
git commit -m "Add ops fleet and seed conflict screens"
```

---

### Task 7: Early end + ledger entries

**Files:**
- Modify: `src/domain/commitment.ts`
- Create: `src/domain/ledger.ts`
- Create: `src/app/api/subscriptions/[id]/early-end/route.ts`
- Modify: `src/app/ops/page.tsx` (Early end controls)

**Interfaces:**
- Consumes: live subscription + plan
- Produces: `earlyEndSubscription(prisma, { subscriptionId, mode: "SCHEDULE" | "IMMEDIATE", endDate?: string })`
  - `SCHEDULE`: status `ENDING`, set `endDate`, domain event `subscription.end_scheduled`, ledger per policy (charge through endDate)
  - `IMMEDIATE`: status `ENDED`, set `endDate` today, event `subscription.ended`, day-prorate `PERIOD_BASE` / `PRORATION`, miles lines, free vehicle status to `AVAILABLE` if no other live

- [ ] **Step 1: Implement ledger builder `src/domain/ledger.ts`**

```ts
import { LedgerEntryType, Plan, Prisma, Subscription } from "@prisma/client";

export function buildEarlyEndLedger(args: {
  subscription: Subscription;
  plan: Plan;
  mode: "SCHEDULE" | "IMMEDIATE";
  asOf: Date;
}): Array<{
  type: LedgerEntryType;
  amount: Prisma.Decimal;
  quantity?: Prisma.Decimal;
  unit?: string;
  explanation: string;
}> {
  const price = args.subscription.monthlyPrice;
  const milesUsed = args.subscription.milesThisPeriod;
  const included = args.plan.monthlyMiles;
  const overageMiles = Math.max(0, milesUsed - included);
  const overageRate = args.plan.overagePerMile;
  const overageAmt = overageRate.mul(overageMiles);

  if (args.mode === "SCHEDULE") {
    return [
      {
        type: LedgerEntryType.PERIOD_BASE,
        amount: price,
        explanation: `Scheduled early end: charge full period base $${price} through endDate (policy: ENDING keeps charge through scheduled end).`,
      },
      {
        type: LedgerEntryType.MILES_INCLUDED,
        amount: new Prisma.Decimal(0),
        quantity: new Prisma.Decimal(included),
        unit: "miles",
        explanation: `Plan includes ${included} miles this period.`,
      },
      {
        type: LedgerEntryType.MILES_USED,
        amount: new Prisma.Decimal(0),
        quantity: new Prisma.Decimal(milesUsed),
        unit: "miles",
        explanation: `Driver used ${milesUsed} miles this period (subscription.milesThisPeriod).`,
      },
      {
        type: LedgerEntryType.OVERAGE,
        amount: overageAmt,
        quantity: new Prisma.Decimal(overageMiles),
        unit: "miles",
        explanation: `Overage ${overageMiles} mi × $${overageRate}/mi = $${overageAmt}.`,
      },
    ];
  }

  // IMMEDIATE: day-prorate within billing period when present; else full month days
  const periodStart = args.subscription.billingPeriodStart ?? args.subscription.startDate;
  const periodEnd = args.subscription.billingPeriodEnd ?? args.asOf;
  const totalDays = Math.max(
    1,
    Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1,
  );
  const usedDays = Math.max(
    1,
    Math.round((args.asOf.getTime() - periodStart.getTime()) / 86400000) + 1,
  );
  const prorated = price.mul(usedDays).div(totalDays).toDecimalPlaces(2);

  return [
    {
      type: LedgerEntryType.PRORATION,
      amount: prorated,
      quantity: new Prisma.Decimal(usedDays),
      unit: "days",
      explanation: `Immediate end: prorate $${price} × ${usedDays}/${totalDays} days = $${prorated}.`,
    },
    {
      type: LedgerEntryType.MILES_INCLUDED,
      amount: new Prisma.Decimal(0),
      quantity: new Prisma.Decimal(included),
      unit: "miles",
      explanation: `Plan includes ${included} miles this period.`,
    },
    {
      type: LedgerEntryType.MILES_USED,
      amount: new Prisma.Decimal(0),
      quantity: new Prisma.Decimal(milesUsed),
      unit: "miles",
      explanation: `Driver used ${milesUsed} miles this period (subscription.milesThisPeriod).`,
    },
    {
      type: LedgerEntryType.OVERAGE,
      amount: overageAmt,
      quantity: new Prisma.Decimal(overageMiles),
      unit: "miles",
      explanation: `Overage ${overageMiles} mi × $${overageRate}/mi = $${overageAmt}.`,
    },
  ];
}
```

- [ ] **Step 2: Add `earlyEndSubscription` to commitment service**

Inside one transaction: lock vehicle; load sub+plan; validate status in live set; apply mode; write ledger rows from `buildEarlyEndLedger`; append domain event; if `IMMEDIATE`, set vehicle `AVAILABLE`.

- [ ] **Step 3: API route + ops buttons**

`POST /api/subscriptions/[id]/early-end` body `{ mode: "SCHEDULE" | "IMMEDIATE", endDate?: "YYYY-MM-DD" }`.

On `/ops`, for each live sub show Schedule end / End now; after success show link/section listing ledger explanations for that sub.

- [ ] **Step 4: Manual verify**

End an ACTIVE seed sub with `IMMEDIATE`; confirm ledger rows in DB and visible explanations on ops.

```bash
docker compose exec -T db psql -U vaya -d vaya -c "SELECT type, amount, explanation FROM ledger_entries ORDER BY created_at DESC LIMIT 5;"
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/ledger.ts src/domain/commitment.ts src/app/api/subscriptions src/app/ops
git commit -m "Add early-end flow with explainable ledger entries"
```

---

### Task 8: Concurrent invariant demo script

**Files:**
- Create: `scripts/test-invariant.ts`
- Modify: `package.json` (already has `test:invariant`)

**Interfaces:**
- Consumes: running app optional — prefer calling `createSubscription` directly against DB for determinism (no server required)
- Produces: exit 0 if exactly one success and one `VEHICLE_NOT_AVAILABLE`; print summary

- [ ] **Step 1: Write `scripts/test-invariant.ts`**

```ts
import { PrismaClient } from "@prisma/client";
import { CommitmentError, createSubscription } from "../src/domain/commitment";

const prisma = new PrismaClient();

async function pickBookableVehicleId() {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: { not: "PENDING_INTAKE" } },
    include: {
      subscriptions: { where: { status: { in: ["RESERVED", "ACTIVE", "ENDING"] } } },
    },
  });
  const free = vehicles.find((v) => v.subscriptions.length === 0);
  if (!free) throw new Error("No bookable vehicle");
  return free.id;
}

async function main() {
  const vehicleId = await pickBookableVehicleId();
  const planId = (await prisma.plan.findFirstOrThrow()).id;
  const drivers = await prisma.driver.findMany({ take: 2 });
  if (drivers.length < 2) throw new Error("Need 2 drivers");

  const results = await Promise.allSettled([
    createSubscription(prisma, { driverId: drivers[0].id, vehicleId, planId }),
    createSubscription(prisma, { driverId: drivers[1].id, vehicleId, planId }),
  ]);

  const wins = results.filter((r) => r.status === "fulfilled");
  const losses = results.filter(
    (r) =>
      r.status === "rejected" &&
      r.reason instanceof CommitmentError &&
      r.reason.code === "VEHICLE_NOT_AVAILABLE",
  );

  const live = await prisma.subscription.count({
    where: { vehicleId, status: { in: ["RESERVED", "ACTIVE", "ENDING"] } },
  });

  console.log({ wins: wins.length, losses: losses.length, live, vehicleId });
  if (wins.length !== 1 || losses.length !== 1 || live !== 1) {
    process.exitCode = 1;
    console.error("INVARIANT TEST FAILED");
  } else {
    console.log("INVARIANT TEST PASSED");
  }
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run**

```bash
npm run test:invariant
```

Expected: `INVARIANT TEST PASSED`

- [ ] **Step 3: Commit**

```bash
git add scripts/test-invariant.ts
git commit -m "Add concurrent commit invariant demo script"
```

---

### Task 9: Setup polish + README done criteria

**Files:**
- Modify: `scripts/setup.sh`, `README.md`
- Modify: deliverable checklist in README

**Interfaces:**
- Produces: clean `npm run setup && npm run dev` path documented

- [ ] **Step 1: Ensure setup runs migrate + seed only (no feed ingest yet)**

Confirm `scripts/setup.sh` does not reference Part 2 ingest.

- [ ] **Step 2: Update README**

Document:

```bash
npm run setup
npm run dev
```

OS: Linux. Point to `DECISIONS.md`, design spec, and `npm run test:invariant`. Mark Part 1 code status Done (or In progress → Done).

- [ ] **Step 3: Full path verify**

```bash
docker compose down -v
npm run setup
npm run test:invariant
npm run dev
```

Manually hit `/`, `/ops`, `/ops/conflicts`.

- [ ] **Step 4: Commit**

```bash
git add README.md scripts/setup.sh
git commit -m "Document Part 1 two-command setup and verify path"
```

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| Marketplace browse/commit | 5, 4 |
| Commit API FOR UPDATE + 409 | 4, 8 |
| Early end + ledger explanations | 7 |
| Ops fleet | 6 |
| Ops conflicts | 6 |
| Seed as-is + quarantine | 3 |
| Partial unique index | 2 |
| `test:invariant` | 8 |
| `npm run setup` / `dev` | 1, 9 |
| No Part 2 telemetry | respected (omitted) |

## Placeholder / consistency review

- Subscription create snapshots `plan.basePrice` into `monthlyPrice` for *new* commits (catalog offer at commit time). Seed rows keep their own snapshots. Matches DECISIONS “price lives on subscription.”
- Quarantine winner rule: earliest `startDate` then `id` — matches DECISIONS `sub-004` over `sub-026`.
- Enum names align with seed (`AVAILABLE`, `ACTIVE`, …) plus `CONFLICTING`.
