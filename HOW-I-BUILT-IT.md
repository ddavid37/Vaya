# How I built it

Short story of how I read the brief, what I understood, and how I built step by step. I worked **iteratively**: build a slice of UI → use it → see what was still unclear → fix the next layer. The screens helped me understand the product as much as the schema did.

---

## How I worked overall

1. Read the question in the brief.
2. Say in plain words what “done” means.
3. Build the smallest thing that answers it.
4. Click through the UI myself.
5. Notice gaps, then repeat.

Part 1 got messy once. I rebuilt thinner and kept going with that loop. Same loop for Part 2.

---

## Part 1 — Marketplace

### Question: supply and demand

**What I understood:** a driver must see what’s free and commit; ops must see fleet truth. Seed stays as-is — don’t clean contradictions away.

**What I built:**
1. Load `seed.json` into Postgres (quarantine dual-live rows; show them on Conflicts).
2. Marketplace browse + commit.
3. Ops fleet view.

**Then I used the UI** and saw: “fleet” is everyone; “my” cars need a personal view later.

### Question: one live commitment per car

**What I understood:** two people cannot win the same car. Concurrent commit → one winner, clear loser (not a 500).

**What I built:**
1. Server commit with row lock + unique live index.
2. Google sign-in so two real accounts can race (session driver id; client can’t spoof).

**Demo I use:**
1. Chrome Profile A → Gmail #1  
2. Chrome Profile B → Gmail #2  
3. Same free car → Commit together  
4. One wins; other gets `409 VEHICLE_NOT_AVAILABLE`

I tried the race in the UI myself. That’s how I knew the error copy had to be sensible.

### Question: one mid-flight change + what’s owed

**What I understood:** pick one change and explain money without real payments. I picked **early end** (matches seed `ENDING`, frees the car).

**What I built:**
1. **My cars** — only this Google account’s commitments (Ops stays full fleet).
2. Date picker: schedule end (`ENDING`, charge through chosen date) or end now (`ENDED`, day-prorate).
3. Ledger lines on the same card (base, miles, overage).

**Then I used My cars** and checked: can I answer “why was I charged that?” from one screen? If not, I fixed the ledger copy.

---

## Part 2 — Telemetry

### Question: what is this feed even for?

**What I understood:** Part 2 is ops **understanding** — “how many miles?” / “why is overage wrong?” — not another marketplace. Device (IMEI) ≠ vehicle. Feed VINs don’t match seed (0 overlap) → parallel dataset, no fake join.

**What I built (in order):**
1. Immutable `telemetry_raw` ingest from `feed.jsonl`.
2. Assemble trips + device assignments (`vinChange` closes/opens windows).
3. Mileage decision per trip: odo **or** `tripDistance`, never average; store rationale.
4. `/ops/disputes` (Mileage review) so I could see the story.
5. Signals + light driving-health heuristic (demo only — not underwriting).

**Iterative UI loop:** each review screen pass showed what was missing — flags, idle next to driver, health colors, assignment history. I didn’t invent the full policy up front; using Review taught me what ops needs to defend a charge.

**Throwaway:** FK from trips → marketplace `vehicles` — wrong once VINs didn’t match.

**Wrong idea caught:** averaging odo and `tripDistance` looks fair, loses disputes.

**Hand-checks:** `vinChange`; TX-480041 impossible odo → trust tripDistance; `tripData` raw-only; rationale on Review.

**Memo:** `TELEMETRY_MEMO.md`. **Tests:** `npm test` (failure modes from `DECISIONS.md`).

Flow I ended on:

```
Raw telemetry → reconstruct trips → mileage decisions with provenance → ops UI that can defend a charge
```

DB = facts. Backend = judgment. UI = the operational story (and how I kept learning the picture).

---

## AI use

- Used Cursor agents for scaffolding, schema, and UI building - allmost for everything. I used a rules doc 'vaya.mdc' to alighn every action that I intent to do by the agent with the predefined context and guardrails.
- Hand-checked: seed dual-ACTIVE quarantine, commit lock + unique index, early-end ledger copy, Google env wiring, My cars manage UX, feed ingest/assemble, dispute screen copy.
- ChatGPT used for better understanding the assighnment and structuring, and generating prompts to the cursor agent.
- In-app: Disputes ★ AI summary + global floating `?` chat (`OPENAI_API_KEY`), both screen-context aware.

## CI**/CD**

- Every merdge from any branch witch is not main alwys scan for any secreats leak with [check-secrets.sh,](http://check-secrets.sh) `.github/workflows/secret-scan.yml`.
