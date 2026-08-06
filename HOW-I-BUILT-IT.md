<!-- Process notes for graders: demos, AI use, and key build choices. -->

# How I built it

Notes on process, AI use, and choices that matter for grading. Keep this short and honest.

---

## Part 1 → Part 2 mindset

Part 1 is about **executing** operations (commit, concurrency, early end). Part 2 is about **understanding** them: turn raw telemetry into explainable answers for ops (“how many miles?”, “why is overage wrong?”).

I kept the same principles as Part 1: small architecture, every file with a purpose, only what the assignment needs. After Part 1 got messy once, I rebuilt thinner and put those rules in Cursor so the agent stays aligned.

For Part 2 I treat it as an **operator-facing product**, not a raw data dump. Schema and ingest landed early so facts exist in Postgres; the dispute screen then drives which assembly and mileage rules we finish. Flow:

```
Raw telemetry → reconstruct trips → mileage decisions with provenance → ops UI that can defend a charge
```

The database stores facts. The backend derives judgment. The UI tells the operational story.

---

## Demonstrating the one-live-commitment invariant

**Decision:** use **Google sign-in** so two real people can race the same car in the UI.

**How it works:** first Google login upserts a `Driver` from that account’s email/name. Commit uses the session driver id (server-side) — the client cannot spoof another driver.

**Demo (simple):**

1. Chrome **Profile A** → Sign in with Gmail #1
2. Chrome **Profile B** → Sign in with Gmail #2
3. Both open Marketplace, same free car, **Commit** at the same time
4. One wins; the other sees a sensible unavailable response (`409 VEHICLE_NOT_AVAILABLE`), not a 500

Two regular Chrome profiles — not Incognito. Same machine, two sessions.

Why not fake “pick a seed driver”? We wanted the video to look like real concurrent demand from two accounts.

---

## Mid-flight change: early end on My cars

**Decision:** pick **end subscription early** (not plan change, not car swap). Manage it on **My cars**, not by hunting through Ops.

**Why early end:** matches seed (`ENDING`), frees the car for the invariant, and forces a clear “what’s owed” ledger without payments.

**Why My cars (not Ops for the driver demo):**

- Ops shows the **entire fleet** from seed (many subscribed cars that are not “mine”). That is correct for fleet truth + conflict quarantine.
- My cars shows **only this Google account’s** commitments. Early end with a **date picker**, then ledger lines on the same card so someone can answer “why was I charged that?”

**Policy written on the ledger:**

- Schedule end → status `ENDING`, charge full period base through the **chosen** end date + miles/overage lines
- End now → status `ENDED`, day-prorate base + miles/overage lines

Ops keeps fleet-level early-end buttons for the pilot; the video / personal demo path is Marketplace → My cars → manage → ledger.

---

## AI use (ongoing)

- Used Cursor agents for scaffolding, schema, and UI brand pass from `website_resources/`.
- Hand-checked: seed dual-ACTIVE quarantine, commit lock + unique index, early-end ledger copy, Google env wiring, My cars manage UX, feed ingest.
- ChatGPT used for structuring Part 2 process notes; outcomes verified against the feed and assignment brief.

*(Expand with throwaways / wrong outputs as the build continues.)*
