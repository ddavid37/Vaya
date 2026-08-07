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

That iterative loop — build → see → understand → next — is how I continuously learned what I was doing. The UI was not only delivery; it was how I understood the overall picture.

Through that, I developed a clearer sense of **what brings value to the platform and what does not**.

---

## 4. Part 1 questions (in that loop)

**Supply / demand** — Driver must see availability and commit; ops must see fleet truth. Seed as-is; quarantine dual-live rows on Conflicts.  
→ Built marketplace, ops fleet, seed load. Used the screens; saw that “my” cars needed a separate path from full fleet.

**One live commitment** — Concurrent commit → one winner, sensible messege to the loser (not 500 error messege).  
→ Built lock + unique index + Google sign-in. Demo: two Chrome profiles, two Gmails, same car, Commit together → one win, `409` for the other. I raced it myself in the UI.

**Mid-flight change + what’s owed** — I picked early end (not swap / plan change).  
→ Built My cars with date picker + ledger (ENDING vs end-now prorate). Clicked through until “why was I charged that?” was answerable on one card.

---

## 5. Part 2 questions (same loop)

**What is the feed for?** Ops understanding miles / disputes — not another marketplace. Device ≠ vehicle; that's a parallel dataset that not intersecting.  
→ Ingest raw → assemble trips / assignments → mileage decisions →  review UI.

Each pass on Review showed what was missing (flags, idle, health as a demo heuristic, assignment history). I threw away an early FK into marketplace vehicles. Hand-checked `vinChange`, TX-480041, raw-only `tripData`. Memo: `TELEMETRY_MEMO.md`. Tests: `npm test`.

---

## What that process bought me

- Confidence the agent stayed inside my rules (`vaya.mdc`)  
- Real screens to judge value, not only theory  
- Clearer read of the assignment description over time.

---

## AI use

- Used Cursor agents for scaffolding, schema, and UI building - allmost for everything. I used a rules doc 'vaya.mdc' to alighn every action that I intent to do by the agent with the predefined context and guardrails.
- Hand-checked: seed dual-ACTIVE quarantine, commit lock + unique index, early-end ledger copy, Google env wiring, My cars manage UX, feed ingest/assemble, dispute screen copy.
- ChatGPT used for better understanding the assighnment and structuring, and generating prompts to the cursor agent.
- In-app: Disputes ★ AI summary + global floating `?` chat (`OPENAI_API_KEY`), both screen-context aware.

## CI/CD

- Every merdge from any branch witch is not main alwys scan for any secreats leak with [check-secrets.sh,](http://check-secrets.sh) `.github/workflows/secret-scan.yml`.

