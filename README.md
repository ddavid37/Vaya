# Vaya

Car subscription marketplace (Part 1) + telemetry (Part 2).

## Workflow

Work directly on `main`. Commit and push to `origin/main` — **no feature branches, no pull requests** unless explicitly asked.

See [`DECISIONS.md`](./DECISIONS.md), [`DB.md`](./DB.md) (every DB change), and [`PLAN.md`](./PLAN.md).

## Stack

Next.js (App Router), TypeScript, Prisma, Supabase Postgres.

## Data

- `data/seed.json` — marketplace seed/reference data
- `data/feed.jsonl` — append-only telemetry stream

## Setup

1. Copy `.env.example` → `.env` and set your Supabase `DATABASE_URL`.
2. Install, migrate, run:

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`db:seed` loads `data/seed.json` as-is and quarantines dual-live rows (e.g. `sub-026` → `CONFLICTING`).

## App

- `/` — marketplace (bookable cars + commit)
- `/ops` — fleet + early end
- `/ops/conflicts` — seed/runtime conflict quarantine

## Layout

```
app/           routes + API
components/    CommitForm, EarlyEndButtons
lib/           db client, subscription domain
prisma/        schema + migrations
scripts/       seed loader
data/          assignment fixtures
DB.md          log of every DB manipulation
```
