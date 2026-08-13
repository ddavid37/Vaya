# How I built it

How I actually worked — and the five things the brief asks for about AI use.

---

## How I worked (short)

I read the assignment once, then used ChatGPT where I was unsure what they wanted. Clarity came later throughout the building.

Before answering in code I set up the workplace: GitHub repo, local clone, `.gitignore` / README, PDF + `seed.json` / `feed.jsonl`, Supabase, Vercel later.

I did **UI first**, then questions one by one: prompt a slice → Cursor → look at the running screen → decide if it had value → next. The UI was how I understood the product, not only delivery.

**Part 1** — marketplace + fleet + Conflicts (seed as-is), one-live-car invariant with Google Auth.js so two real people can race a commit, early end on My cars with ledger copy.

**Part 2** — ingest → assemble → mileage decisions → Mileage review / Signals. Parallel dataset (feed VINs ≠ seed). Memo: `TELEMETRY_MEMO.md`.

Rough landing order: Prisma + partial unique index → seed → UI → Google auth → commit API → early end → telemetry → docs.

---

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

**In-app (UI) OpenAI** (`OPENAI_API_KEY`): Disputes ★ AI summary + global floating `?` chat, both screen-context aware. Separate from how I *built* the app.

**Secrets hygiene (not Gitleaks):** a small custom scanner —

- Script: `be/scripts/check-secrets.sh` (`npm run check:secrets`) — checks for tracked secret-like paths and suspicious patterns in commits vs `origin/main`  
- Cursor hook: `.cursor/hooks/pre-pr-secret-scan.sh` runs that script before `gh pr create` / `git push` off `main`  
- CI: `.github/workflows/secret-scan.yml` runs the same script on pull requests  
- Manual on `main`: `FORCE=1 npm run check:secrets`

I mostly worked directly on `main`, so the PR Action ran rarely; the script/hook still document the intent. Not the Gitleaks product — our own bash check.

**Subagents / MCP:** I did not build a custom multi-agent or MCP stack for the core marketplace/telemetry work. Occasional IDE tooling for docs/browser checks when useful; the daily loop was Cursor agent + rules + running UI.

---

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
- **Constrainer prompts harder on “do not invent joins or clean seed contradictions.”** The rules file said it; I’d repeat it at the start of every Part 2 prompt.  
- **Keep a short “hand-check checklist” in the repo** (race commit, Conflicts row, one bad trip) and run it before calling a slice done.

---

## AI use (summary)

- Cursor agents + `vaya.mdc` for almost all build work  
- ChatGPT for assignment understanding and prompt shaping  
- In-app OpenAI for Disputes ★ summary + floating `?` chat  
- Custom secret scan script + PR Action + Cursor hook (not Gitleaks)

