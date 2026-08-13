# How I built it

How I actually worked — top to bottom — and how that process taught me.



## 1. Read the brief

I read the assignment document once, top to bottom. Then I analyzed it and started forming answers myself. Where I was unsure what they wanted, I used ChatGPT to understand the asks better. I still did not understand everything at that point — that was okay. Clarity came later thourout the building.



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



## What that process bought me

- Confidence the agent stayed inside my rules (`vaya.mdc`)  
- Real screens to judge value, not only theory  
- Clearer read of the assignment description over time  
- A demo path that proves the invariant with two authenticated accounts, not only a UI label



## AI Use



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

- **Inventing a marketplace telemetry join:** Early Part 2, the agent wanted trips (or vehicles) linked to seed marketplace cars — a foreign key or fuzzy VIN match — so “one fleet” would show in the UI. 
  - **Wrong output:** schema/UI assumptions that feed cars are the same physical cars as `seed.json`.
  - **How I noticed:** I compared and verified that the VINs are different to proove my assumption. 
  - **What I did:** threw that away; kept parallel datasets; said so in `DECISIONS.md` and the telemetry memo. Ops explainability does not require a fake join.
- **Second example (UI):** after the `fe/` / `be/` split, Mileage review “still had” Tailwind classes like `border-green-400` / `text-yellow-600` in code, but frames and FAIR/HEALTHY colors disappeared on screen. I noticed against a video I’d recorded earlier. 
  - Fix was plain CSS classes in `globals.css` (Tailwind wasn’t emitting those utilities from domain helper strings). Trust the running UI, not only the class names in the file esspecially when changing and orgenizing the project directories.



## 3. What you threw away


| Thrown away                                                         | Why                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FK / single-fleet link feed → seed vehicles                         | Invented join; VINs don’t match between the different datasets.                                                                                                                                                                                         |
| Web-app view as Driver vs Operator                                  | Mileage review (Part 2) sat next to Fleet/Conflicts like just another ops page so it was confused and inefficient for reviewing. Replaced it with a Part 1 / Part 2 views toggle.                                                                       |
| Non-auth commit (fake “pick a driver” without real authenitication) | Did not prove the invariant well enough on my end — concurrent demand needs two real people. So I implemented Google Auth + live Vercel login so graders can race the same car without local secret setup (verified that when deployed localy as well). |




## 4. What you checked by hand

This is where I wouldn’t trust the agent alone. Almost every slice got a retrospective look from me, but I was stricter on data handling and integrity (seed, commitments, miles). I usually checked through the running app UI. If the screen couldn’t explain a requirement, it wasn’t done.

- **Two people racing one car:** Two Chrome profiles, two real Gmails from two different browsers, same free car, Commit together → one wins, the other gets a clear “not available” message without crashing the app. In addition, after reloading the page the taken car is gone.
- **What’s owed on early end:** On My cars, schedule end and end now, then read the ledger.
- **Seed contradictions:** After load, I opened Conflicts and checked the car that had two live subscriptions. One stayed live; the other was quarantined.
- **UI/UX:** Occasionally general UI/UX with the live app.
- **Public deployment:** Live Vercel site and Google login (offered that as seamless approach for submission, while local deployment is a place for secret misconfigurations).
- **Trusted miles on Review:** On Mileage review view I opened a real trip and checked the mileage decision — not only that the card looked fine. I confirmed the trusted miles matched either the odometer change or `tripDistance`, green/healthy are not enough if the miles are wrong.



## 5. What you’d have done differently

- **Day-zero documentation — referring the agent to it through** `vaya.mdc`**.** Useful, and especially useful for files that document evolving process like `DECISIONS.md` and `HOW-I-BUILT-IT.md`.
- **Freeze forks in** `DECISIONS.md` **before more UI** (especially Part 1 vs Part 2 header) so agents don’t thrash nav.
- **After any folder move (**`fe` **/** `be`**), immediately check that dynamic Tailwind classes still paint** — or prefer plain CSS for status colors from day one. Either way, pay attention to that and minimize manual actions that affect many other things and knock the agent off track.
- **Constrain prompts harder:** do not invent joins or new placeholder data without explicitly notifying me.



## CI/CD

- Every merge from any branch that is not `main` always scans for secret leaks with `be/scripts/check-secrets.sh` and `.github/workflows/secret-scan.yml`.

