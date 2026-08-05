# Vaya

Engineering home assignment — car subscription marketplace (Part 1) + telemetry (Part 2).

## Status

**Part 1 in progress.** Next.js + Postgres + Prisma scaffolding is wired up; models, seed logic, and UI features come next. See:

- [`DECISIONS.md`](./DECISIONS.md) — architecture first, then forks and unspecified calls
- [`PLAN.md`](./PLAN.md) — build order toward the two-command demo

## Data

Assignment fixtures (load as-is, do not hand-clean):

- `data/seed.json` — dealers, plans, vehicles, drivers, subscriptions, events
- `data/feed.jsonl` — one month of vendor webhook/REST telemetry

## Run

```bash
npm run setup
npm run dev
```

`npm run setup` starts Postgres via Docker Compose, runs Prisma migrations, and seeds the database. Target OS is **Linux** (Docker Postgres also verified on macOS during development).

## Deliverables (assignment checklist)

| Artifact | Status |
|---|---|
| Architecture / DECISIONS | Done (this branch) |
| Code Part 1 + Part 2 | Planned |
| HOW-I-BUILT-IT | Pending build |
| Telemetry memo | Pending (read feed first; draft after ingest) |
| Video | Pending |
| README two-command | Pending implementation |
