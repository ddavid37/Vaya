<!-- Setup and run notes for the Vaya take-home demo. -->

# Vaya

Car subscription marketplace (Part 1) + telemetry (Part 2).

**Built on:** macOS (Darwin).

**Live deployment:** [https://vaya-swart.vercel.app](https://vaya-swart.vercel.app)

## Run — one command for both parts

Part 1 (Marketplace) and Part 2 (Telemetry) are the **same app**. You do **not** need two start commands.

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) and use the header **Part 1** / **Part 2** buttons to switch modes in the UI (tabs change with the part).

Same on the live site: [https://vaya-swart.vercel.app](https://vaya-swart.vercel.app) → click **Part 1** / **Part 2**.

## Workflow

Work directly on `main`. After **every** change in this project: **commit and push** to `origin/main` — no waiting to batch. **No feature branches, no pull requests** unless explicitly asked.

## Status

Part 1 marketplace and Part 2 telemetry are complete: schema, ingest, assemble, `/ops/disputes`, failure-mode tests (`npm test`), and `TELEMETRY_MEMO.md`.

## Stack

Next.js (App Router), TypeScript, Prisma, Supabase Postgres, Auth.js (Google).

## Data

- `be/data/seed.json` — marketplace seed/reference data
- `be/data/feed.jsonl` — append-only telemetry stream

## Setup (first time)

1. Create `.env` at the repo root. Set `DATABASE_URL`, `AUTH_SECRET`, Google OAuth vars, and optionally `OPENAI_API_KEY` for Disputes ★ AI summaries.
2. Install, migrate, load data, then the one run command:

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run db:ingest
npm run db:assemble
npm run dev
```

After that, day-to-day is only `npm run dev`.

`db:seed` loads `be/data/seed.json` as-is and quarantines dual-live rows (e.g. `sub-026` → `CONFLICTING`).

`db:ingest` / `db:assemble` load the feed into telemetry tables (destructive to telemetry only).

```bash
npm test
```

### Google OAuth (Marketplace sign-in)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **Credentials** → Create **OAuth client ID** (Web application).
2. Authorized redirect URIs (add **both**):
   - `http://localhost:3000/api/auth/callback/google`
   - `https://vaya-swart.vercel.app/api/auth/callback/google`
3. Put Client ID / Secret in `.env` as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
4. Local: `AUTH_SECRET` (`openssl rand -base64 32`) and `AUTH_URL=http://localhost:3000`.  
   Production (Vercel): `AUTH_URL=https://vaya-swart.vercel.app`.

**Invariant demo:** two Chrome profiles, each signed in with a different Gmail, Commit the same car → one win, one clear 409. Details in `DECISIONS.md` / `HOW-I-BUILT-IT.md`.

## App

**Part 1 — Marketplace** (header **Part 1**)
- `/` — marketplace (Google sign-in + commit)
- `/mine` — your commitments: early end (date picker) + ledger + monthly total
- `/ops` — fleet + early end
- `/ops/conflicts` — seed/runtime conflict quarantine

**Part 2 — Telemetry** (header **Part 2**)
- `/ops/disputes` — Mileage review (trips, driver unknown, manual confirm, scan/insurance placeholders, ★ AI)
- `/ops/signals` — driving signals (avg speed, maxSpeed, hard accel/brake from tripMetrics)

## Layout

```
fe/                UI (Next.js app dir)
  app/             pages + API routes
  components/      CommitForm, AuthButtons, …
  public/          static assets

be/                server / domain
  auth.ts          Auth.js (Google → Driver)
  lib/             db, subscriptions, mileage, …
  prisma/          schema + migrations
  scripts/         seed, ingest, assemble
  tests/           telemetry failure-mode tests
  data/            seed.json, feed.jsonl

DECISIONS.md       architecture + forks
HOW-I-BUILT-IT.md  process / AI use
TELEMETRY_MEMO.md  Part 2 memo
DB.md              DB change log
README.md          setup
```
