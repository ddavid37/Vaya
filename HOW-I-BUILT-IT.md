# How I built it

How I actually worked — top to bottom — and how that process taught me what the brief was asking for.

---

## 1. Read the brief

I read the assignment document once, top to bottom. Then I analyzed it and started forming answers myself.

Where I was unsure what they wanted, I used ChatGPT to understand the asks better. I still did not understand everything at that point — that was okay. Clarity came later thourout the building.

---

## 2. Set up the environment

Before answering questions in code, I set up the workplace:

1. Created the GitHub repo
2. Created the matching local workspace and cloned it
3. Added fundamental files — `.gitignore`, `README`, imported the assignment PDF and the two data files (`seed.json`, `feed.jsonl`)
4. Cursor rules doc (`.cursor/rules/vaya.mdc`) so the agent stayed aligned with my intentions, context, and boundaries. And a secrets-scanning script for non-`main` work / PRs (`scripts/check-secrets.sh` + GitHub Action).
5. Prepared for later live deploy (Vercel)
6. Set up the database on Supabase so I could see schemas and tables visually and potentially control them from there.

---

## 3. UI first, then questions one by one

I did not jump straight into every domain question in the abstract. I structured the UI workspace first and worked with the screens in front of me.

For each portion of the assignment:

1. Write a prompt for that slice
2. Run it through Cursor
3. Look at the output in the running UI
4. Decide if it had real value and if the screen made sense
5. Fix / prompt the next slice
6. Final review with myself and using Cursor

That iterative loop — build → see → understand → next — is how I continuously learned what I was doing. The UI was not only delivery; it was how I understood the overall picture.

Through that, I developed a clearer sense of **what brings value to the platform and what does not**.

Lastly, I added an overall review once any major parts are completed - to verify how they are alihn with each other.

---

## 4. Part 1 questions (in that loop)

**Supply / demand** — Driver must see availability and commit; ops must see fleet truth. Seed as-is; quarantine dual-live rows on Conflicts.  
→ Built marketplace, ops fleet, seed load. Used the screens; saw that “my” cars needed a separate path from full fleet.

**One live commitment (invariant)** — Concurrent commit → one winner, sensible message to the loser (not a 500).

Why Google auth matters here: the critical showcase is **two different real people racing the same car**. A fake “pick driver” dropdown would not look like concurrent demand. So I set up **Auth.js + Google OAuth** (`auth.ts`): first login upserts a `Driver` from the Gmail profile and puts `driverId` on the session JWT. Commit never trusts a client-supplied driver id.

How commit is wired:
1. UI **Commit** → `POST /api/subscriptions` with `vehicleId` + `planId`  
2. API reads `session.driverId` (401 if signed out)  
3. `createSubscription` in `lib/subscriptions.ts` runs a DB transaction: `SELECT … FROM vehicles … FOR UPDATE`, then insert `ACTIVE` subscription  
4. Postgres **partial unique index** `subscriptions_one_live_per_vehicle` on `vehicle_id` where status ∈ `RESERVED | ACTIVE | ENDING` — that is the real enforcement  
5. Unique violation (`P2002`) → API **409** `VEHICLE_NOT_AVAILABLE` → UI shows that code next to Commit  

**Demo (invariant showcase):** Chrome Profile A + Gmail #1, Profile B + Gmail #2, same free car, Commit together → one wins, the other sees `VEHICLE_NOT_AVAILABLE: Vehicle already has a live commitment`. I raced it myself. The UI message is the surface; the index + lock are where the invariant holds.

**Mid-flight change + what’s owed** — I picked early end (not swap / plan change).  
→ Built My cars with date picker + ledger (ENDING vs end-now prorate). Clicked through until “why was I charged that?” was answerable on one card.

---

## 5. Part 2 questions (same loop)

**What is the feed for?** Ops understanding miles / disputes — not another marketplace. Device ≠ vehicle; parallel dataset (feed VINs don’t match seed).  
→ Ingest raw → assemble trips / assignments → mileage decisions → review UI.

Each pass on Review showed what was missing (flags, idle, health as a demo heuristic, assignment history). I threw away an early FK into marketplace vehicles. Hand-checked `vinChange`, TX-480041, raw-only `tripData`. Memo: `TELEMETRY_MEMO.md`. Tests: `npm test`.

---

## Technical steps (what actually landed in the stack)

Rough build order after the repo existed:

1. **Prisma schema + migrations** on Supabase (`DATABASE_URL`) — marketplace tables, then telemetry tables later  
2. **Partial unique index** for one live sub per vehicle (migration SQL)  
3. **`npm run db:seed`** — load seed as-is; quarantine dual-live into `CONFLICTING` + `data_conflicts`  
4. **Next.js App Router UI** — Marketplace, My cars, Fleet, Conflicts; later Part 2 Review / Signals  
5. **Auth.js Google** — env `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` / `AUTH_SECRET`; callback upserts `Driver`  
6. **Commit API** — `POST /api/subscriptions` → session driver → `FOR UPDATE` + create → 409 on conflict  
7. **Early-end API / My cars** — schedule or end-now; ledger rows with explanations  
8. **Telemetry** — `npm run db:ingest` / `db:assemble`; `lib/mileage.ts` decide miles; `/ops/disputes`  
9. **Docs** — `DECISIONS.md`, `DB.md`, `TELEMETRY_MEMO.md`, this file  

I kept using the running app after each step so the next technical piece was driven by what the screen still couldn’t explain.

---

## What that process bought me

- Confidence the agent stayed inside my rules (`vaya.mdc`)  
- Real screens to judge value, not only theory  
- Clearer read of the assignment description over time  
- A demo path that proves the invariant with two authenticated accounts, not only a UI label  

---

## AI use

- Used Cursor agents for scaffolding, schema, and UI building - allmost for everything. I used a rules doc 'vaya.mdc' to alighn every action that I intent to do by the agent with the predefined context and guardrails.
- Hand-checked: seed dual-ACTIVE quarantine, commit lock + unique index, early-end ledger copy, Google env wiring, My cars manage UX, feed ingest/assemble, dispute screen copy.
- ChatGPT used for better understanding the assighnment and structuring, and generating prompts to the cursor agent.
- In-app: Disputes ★ AI summary + global floating `?` chat (`OPENAI_API_KEY`), both screen-context aware.

## CI/CD

- Every merdge from any branch witch is not main alwys scan for any secreats leak with [check-secrets.sh,](http://check-secrets.sh) `.github/workflows/secret-scan.yml`.

