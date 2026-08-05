# How I built it

Notes on process, AI use, and choices that matter for grading. Keep this short and honest.

---

## Part 1

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



## AI use (ongoing)

- Used Cursor agents for scaffolding, schema, and UI brand pass from `website_resources/`.
- Hand-checked: seed dual-ACTIVE quarantine, commit lock + unique index, early-end ledger copy, Google env wiring.

*(Expand with throwaways / wrong outputs as the build continues.)*