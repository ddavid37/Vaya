# How I built it

How I actually worked — top to bottom — and how that process taught me what the brief was asking for.

## 1. Read the brief

I read the assignment document once, top to bottom. Then I analyzed it and started forming answers myself.

Where I was unsure what they wanted, I used ChatGPT to understand the asks better. I still did not understand everything at that point — that was okay. Clarity came later thourout the building.

## 2. Set up the environment

Before answering questions in code, I set up the workplace:

1. Created the GitHub repo
2. Created the matching local workspace and cloned it
3. Added fundamental files — `.gitignore`, `README`, imported the assignment PDF and the two data files (`seed.json`, `feed.jsonl`)
4. Cursor rules doc (`.cursor/rules/vaya.mdc`) so the agent stayed aligned with my intentions, context, and boundaries. And a secrets-scanning script for non-`main` work / PRs (`be/scripts/check-secrets.sh` + GitHub Action).
5. Prepared for later live deploy (Vercel)
6. Set up the database on Supabase so I could see schemas and tables visually and potentially control them from there.

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

## 4. Part 1 questions (in that loop)

**Supply / demand** — Driver must see availability and commit; ops must see fleet truth. Seed as-is; quarantine dual-live rows on Conflicts.  
→ Built marketplace, ops fleet, seed load. Used the screens; saw that “my” cars needed a separate path from full fleet.

Fleet Truth shows seed driver names (e.g. Sam Reyes) next to live commitments for readability — labels from `seed.json`, not invented people. They don’t change availability, the one-live-car invariant, ledger math, or conflict quarantine.

**One live commitment (invariant)** — Concurrent commit → one winner, sensible message to the loser (not a 500).

Why Google auth matters here: the critical showcase is **two different real people racing the same car**. A fake “pick driver” dropdown would not look like concurrent demand. So I set up **Auth.js + Google OAuth** (`be/auth.ts`): first login upserts a `Driver` from the Gmail profile and puts `driverId` on the session JWT. Commit never trusts a client-supplied driver id.

How commit is wired:

1. UI **Commit** → `POST /api/subscriptions` with `vehicleId` + `planId`
2. API reads `session.driverId` (401 if signed out)
3. `createSubscription` in `be/lib/subscriptions.ts` runs a DB transaction: `SELECT … FROM vehicles … FOR UPDATE`, then insert `ACTIVE` subscription
4. Postgres **partial unique index** `subscriptions_one_live_per_vehicle` on `vehicle_id` where status ∈ `RESERVED | ACTIVE | ENDING` — that is the real enforcement
5. Unique violation (`P2002`) → API **409** `VEHICLE_NOT_AVAILABLE` → UI shows that code next to Commit

**Demo (invariant showcase):** Chrome Profile A + Gmail #1, Profile B + Gmail #2, same free car, Commit together → one wins, the other sees `VEHICLE_NOT_AVAILABLE: Vehicle already has a live commitment`. I raced it myself. The UI message is the surface; the index + lock are where the invariant holds.

**Mid-flight change + what’s owed** — I picked early end (not swap / plan change).  
→ Built My cars with date picker + ledger (ENDING vs end-now prorate). Clicked through until “why was I charged that?” was answerable on one card.

## 5. Part 2 questions (same loop)

**What is the feed for?** Ops understanding miles / disputes — not another marketplace. Device ≠ vehicle; parallel dataset (feed VINs don’t match seed).  
→ Ingest raw → assemble trips / assignments → mileage decisions → review UI.

Each pass on Review showed what was missing (flags, idle, health as a demo heuristic, assignment history). I threw away an early FK into marketplace vehicles. Hand-checked `vinChange`, TX-480041, raw-only `tripData`. Memo: `TELEMETRY_MEMO.md`. Tests: `npm test`.

## Technical steps (what actually landed in the stack)

Rough build order after the repo existed:

1. **Prisma schema + migrations** on Supabase (`DATABASE_URL`) — marketplace tables, then telemetry tables later
2. **Partial unique index** for one live sub per vehicle (migration SQL)
3. `**npm run db:seed**` — load seed as-is; quarantine dual-live into `CONFLICTING` + `data_conflicts`
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

## 1. How you set the model up

**Primary tool:** Cursor agents for almost everything — scaffolding, schema, UI, wiring. I steered with prompts and a rules file; I did not hand-write most of the app.

**ChatGPT:** understanding the assignment and structuring prompts for Cursor — not production code.

**Rules file (always on):** `.cursor/rules/vaya.mdc`  
That was the main “custom instructions” surface. It told the agent:

- The PDF is source of truth — don’t invent requirements  
- Part 1 vs Part 2 data scopes  
- Stack (Next / Prisma / Supabase), repo layout (`fe/` / `be/`)  
- Work on `main`; never commit secrets  
- Keep it simple and direct. Document forks in `DECISIONS.md` and DB changes in `DB.md`

I pointed agents at `DECISIONS.md` / `PLAN.md` / `DB.md` as we went so they stayed aligned with choices already made.

**In-app (UI) OpenAI** (`OPENAI_API_KEY`): Disputes ★ AI summary + global floating `?` chat, both screen-context aware. Separate from how I built the app.

**Secrets hygiene (not Gitleaks):** a small custom scanner —

- Script: `be/scripts/check-secrets.sh` (`npm run check:secrets`) — checks for tracked secret-like paths and suspicious patterns in commits vs `origin/main`  
- Cursor hook: `.cursor/hooks/pre-pr-secret-scan.sh` runs that script before `gh pr create` / `git push` off `main`  
- CI: `.github/workflows/secret-scan.yml` runs the same script on pull requests  
- Manual on `main` with: `FORCE=1 npm run check:secrets`

I mostly worked directly on `main`, so the PR Action ran rarely; the script/hook still document the intent. Not the Gitleaks product — our own bash check.

**Subagents / MCP:** I did not build a custom multi-agent or MCP stack. Occasional IDE tooling for docs/browser checks when useful.  



Ultimetly the ongoing loop was Cursor agent + rules + running UI + me.

## 2. Where it was wrong

**Example — inventing a marketplace ↔ telemetry join**

Early Part 2, the agent wanted trips (or vehicles) linked to seed marketplace cars — a foreign key or fuzzy VIN match — so “one fleet” would show in the UI.

**Wrong output:** schema/UI assumptions that feed cars *are* the same physical cars as `seed.json`.

**How I noticed:** I compared VINs. Feed uses values like `1HGCV1F…` / `JM1BPB…`; they do not appear in the seed. Joining them would invent identity the files don’t support.

**What I did:** threw that away; kept parallel datasets; said so in `DECISIONS.md` and the telemetry memo. Ops explainability does not require a fake join.

**Second example (UI):** after the `fe/` / `be/` split, Mileage review “still had” Tailwind classes like `border-green-400` / `text-yellow-600` in code, but frames and FAIR/HEALTHY colors disappeared on screen. I noticed against a video I’d recorded earlier. Fix was plain CSS classes in `globals.css` (Tailwind wasn’t emitting those utilities from domain helper strings). Trust the running UI, not only the class names in the file.

---

## 3. What you threw away

Roughly a small slice of early work — on the order of **~5–15%** of the first schema/UI passes — not half the repo.


| Thrown away                                 | Why                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| FK / single-fleet link feed → seed vehicles | Invented join; VINs don’t match                                                        |
| Header as Driver vs Operator                | Blurred Part 2 Disputes into “ops” next to Fleet; replaced with Part 1 / Part 2 toggle |
| Bits of over-built nav / empty polish       | Didn’t help defend a charge or prove the invariant                                     |


Kept what survived contact with the screens and the data files.

---

## 4. What you checked by hand

This is where I wouldn’t trust the agent alone — invariant, money language, and dirty data.


| What I verified myself                                                                         | Why that, not something else                                                |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Seed dual-ACTIVE on `veh-004` → Conflicts / `CONFLICTING`                                      | Assignment says load as-is; silently “fixing” seed would fail the brief     |
| Two Chrome profiles + two Gmails, same car, Commit → one win / one `409 VEHICLE_NOT_AVAILABLE` | The showcase is concurrent demand; a fake driver dropdown wouldn’t prove it |
| Partial unique index + `FOR UPDATE` path in `subscriptions.ts` / migration SQL                 | UI copy can lie; the index is the real lock                                 |
| Early-end ledger on My cars (“would I paste this in an email?”)                                | Brief cares about defendable charges, not payment processors                |
| Feed: `vinChange` on IMEI `…003`, TX-480041 bad odo, raw-only `tripData`                       | Easy for an agent to average miles or invent trips; I checked the file      |
| Google OAuth + env on Vercel (live demo)                                                       | Graders hit the live link; local secrets are easy to get wrong              |


I spent less hand time on font/spacing polish. Pretty UI doesn’t prove the invariant or a mileage decision.

---

## 5. What you’d have done differently

- **Write these five HOW-I-BUILT-IT sections as I went**, not as a follow-up — they’re part of the deliverable, not an afterthought.  
- **Freeze forks in** `DECISIONS.md` **before more UI** (especially Part 1 vs Part 2 header) so agents don’t thrash nav.  
- **After any folder move (**`fe`**/**`be`**), immediately check that dynamic Tailwind classes still paint** — or prefer plain CSS for status colors from day one.  
- **Constrain prompts harder on “do not invent joins or clean seed contradictions.”** The rules file said it; I’d repeat it at the start of every Part 2 prompt.  
- **Keep a short “hand-check checklist” in the repo** (race commit, Conflicts row, one bad trip) and run it before calling a slice done.

## CI/CD

- Every merdge from any branch witch is not main alwys scan for any secreats leak with [check-secrets.sh,](http://check-secrets.sh) `.github/workflows/secret-scan.yml`.

---



