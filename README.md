<!-- Setup and run notes for the Vaya take-home demo. -->

# Vaya

Car subscription marketplace (Part 1) + telemetry (Part 2).

**Built on:** macOS (Darwin).

**Live deployment (recommended):** [https://vaya-swart.vercel.app](https://vaya-swart.vercel.app)

**Please test via the live link**, not a local clone, unless you specifically need to. The deployed app already has Google OAuth and other secrets configured. Running locally means you must create your own Google OAuth client and `.env` secrets — unnecessary for reviewing the demo.

On the live site, use the header **Part 1** / **Part 2** buttons to switch modes.

## Deliverables

- [DECISIONS.md](./DECISIONS.md)
- [HOW-I-BUILT-IT.md](./HOW-I-BUILT-IT.md)
- [TELEMETRY_MEMO.md](./TELEMETRY_MEMO.md)

## Run locally (optional)

Part 1 and Part 2 are the **same app** — one command, then switch with the header **Part 1** / **Part 2** buttons:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Workflow

Work directly on `main`. After **every** change in this project: **commit and push** to `origin/main` — no waiting to batch. **No feature branches, no pull requests** unless explicitly asked.

## Status

Part 1 marketplace and Part 2 telemetry are complete: schema, ingest, assemble, `/ops/disputes`, failure-mode tests (`npm test`), and `TELEMETRY_MEMO.md`.

## Stack

Next.js (App Router), TypeScript, Prisma, Supabase Postgres, Auth.js (Google).

## Data

- `be/data/seed.json` — marketplace seed/reference data
- `be/data/feed.jsonl` — append-only telemetry stream

## Setup — local only (skip if using the live link)

Only needed if you run on your machine. You will need your own Google OAuth credentials (and DB URL); the live deployment already has these set so reviewers do not need them.

1. **`.env` at repo root** with:
   - `DATABASE_URL` — Postgres connection string  
   - `AUTH_SECRET` — e.g. `openssl rand -base64 32`  
   - `AUTH_URL=http://localhost:3000`  
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — [Google Cloud Console](https://console.cloud.google.com/) → Credentials → OAuth client (Web), redirect URI: `http://localhost:3000/api/auth/callback/google`  
   - `OPENAI_API_KEY` — optional (★ AI / chat)

2. **Install, load data, run:**

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run db:ingest
npm run db:assemble
npm run dev
```

After that: `npm run dev` only. Tests: `npm test`.

**Invariant demo:** two Chrome profiles, two Gmails, Commit the same car → one wins, other gets 409. See `DECISIONS.md` / `HOW-I-BUILT-IT.md`.

## App

**Part 1 — Marketplace** (header **Part 1**)
- `/` — marketplace (Google sign-in + commit)
- `/mine` — your commitments: early end (date picker) + ledger + monthly total
- `/ops` — fleet + early end
- `/ops/conflicts` — seed/runtime conflict quarantine

**Part 2 — Telemetry** (header **Part 2**)
- `/ops/disputes` — Mileage review (trips, driver unknown, manual confirm, scan/insurance placeholders, ★ AI)
- `/ops/signals` — driving signals (avg speed, maxSpeed, hard accel/brake from tripMetrics)

## Repo structure

```
Vaya/
├── fe/                      # UI (Next.js)
│   ├── app/                 # pages + API routes
│   ├── components/
│   ├── assets/              # logo, hero image
│   └── public/
├── be/                      # server / domain
│   ├── auth.ts              # Google → Driver
│   ├── lib/                 # db, subscriptions, mileage, …
│   ├── prisma/              # schema + migrations
│   ├── scripts/             # seed, ingest, assemble
│   ├── tests/
│   └── data/                # seed.json, feed.jsonl
├── DECISIONS.md             # architecture + forks
├── HOW-I-BUILT-IT.md
├── TELEMETRY_MEMO.md
├── DB.md
├── README.md
└── package.json             # one install / one `npm run dev`
```
