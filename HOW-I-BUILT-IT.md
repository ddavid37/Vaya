<!-- Process notes for graders: demos, AI use, and key build choices. -->

# How I built it

Notes on process, AI use, and choices that matter for grading. Keep this short and honest.

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
- Hand-checked: seed dual-ACTIVE quarantine, commit lock + unique index, early-end ledger copy, Google env wiring, My cars manage UX.

*(Expand with throwaways / wrong outputs as the build continues.)*
