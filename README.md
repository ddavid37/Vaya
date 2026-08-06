# Vaya

Car subscription marketplace (Part 1) + telemetry (Part 2).

## Workflow

Work directly on `main`. After **every** change in this project: **commit and push** to `origin/main` — no waiting to batch. **No feature branches, no pull requests** unless explicitly asked.

## Status

Part 1 marketplace and Part 2 telemetry are complete: schema, ingest, assemble, `/ops/disputes`, failure-mode tests (`npm test`), and `TELEMETRY_MEMO.md`.

## Stack

Next.js (App Router), TypeScript, Prisma, Supabase Postgres, Auth.js (Google).

## Data

- `data/seed.json` — marketplace seed/reference data
- `data/feed.jsonl` — append-only telemetry stream

## Setup

1. Copy `.env.example` → `.env`. Set `DATABASE_URL`, `AUTH_SECRET`, and Google OAuth vars (below).
2. Install, migrate, run:

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`db:seed` loads `data/seed.json` as-is and quarantines dual-live rows (e.g. `sub-026` → `CONFLICTING`).

`db:ingest` loads `data/feed.jsonl` into telemetry tables (raw + device assignments). Destructive to telemetry only.

`db:assemble` builds trips + mileage decisions from raw events.

```bash
npm run db:ingest
npm run db:assemble
npm test
```

### Google OAuth (Marketplace sign-in)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **Credentials** → Create **OAuth client ID** (Web application).
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
3. Put Client ID / Secret in `.env` as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
4. Set `AUTH_SECRET` (`openssl rand -base64 32`) and `AUTH_URL=http://localhost:3000`.

**Invariant demo:** two Chrome profiles, each signed in with a different Gmail, Commit the same car → one win, one clear 409. Details in `DECISIONS.md` / `HOW-I-BUILT-IT.md`.

## App

**Driver**
- `/` — marketplace (Google sign-in + commit)
- `/mine` — your commitments: early end (date picker) + ledger + monthly total

**Ops**
- `/ops` — fleet + early end
- `/ops/conflicts` — seed/runtime conflict quarantine
- `/ops/disputes` — mileage disputes (IMEI → time-bounded VIN; trusted miles + provenance)

## Layout

```
app/           routes + API
auth.ts        Auth.js (Google → Driver)
components/    CommitForm, AuthButtons, …
lib/           db client, subscription + mileage domain
prisma/        schema + migrations
scripts/       seed, ingest, assemble
tests/         telemetry failure-mode tests
data/          assignment fixtures
DB.md          log of every DB manipulation
TELEMETRY_MEMO.md  Part 2 memo
```
