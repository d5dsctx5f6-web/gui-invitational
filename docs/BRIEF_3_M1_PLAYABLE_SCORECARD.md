# BRIEF 3 — M1: THE PLAYABLE SCORECARD

**Project:** The GUI Invitational app · **Milestone:** M1 (first demo gate) · **Issued:** Jul 20, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 2 complete (full schema in Supabase; engine core — handicap conversion, net scoring, F9/B9/18 match state — passing 18 tests).
**Gate (physical):** Chris scores a real 18 holes on his phone for one foursome and watches the duo match state (F9 / B9 / 18) update live and correctly as holes are entered.

---

## Context (read once)

M0 shipped the rails; Brief 2 shipped the skeleton — the database and a tested, pure scoring-engine core that computes duo match state from net scores. But none of it is *touchable* yet: there's no screen to enter a score into. **Brief 3 builds that screen.** It is the first milestone since M0 that changes what Chris sees on his phone, and it's the thing he'll take to a real round with buddies for Field Test 1 this fall.

This brief is deliberately **UI + wiring, not new engine logic.** The scoring brain already exists in `/engine`; this brief gives it hands and a face. The heavy remaining engine work — skins, reverse mulligan, individual race, standings, shortened event — is **Brief 4** (the M2 gate) and is explicitly out of scope here.

Grounding docs in `/docs` and Chris's Desktop folder: `PRODUCT_SPEC.md` (§2 competition spec, §4 player-experience principles — read §4, it governs this UI), `ARCHITECTURE.md` (§2 access model, §3 store-raw-derive-everything), `gui_invitational_mockup.html` (the design north star — match the scorekeeper screen's look and feel), `TESTING_AND_HARDENING.md`. The visual language is the manual-leaderboard aesthetic already in the mockup: spruce green `#0E3B2E`, cream tile `#F2E9D4`, gold `#D8A73B`, red `#E5493B`, Oswald + Marcellus. **Reuse the mockup's scorekeeper screen as the design reference** — this brief makes it real and wired, not a fresh design.

---

## Player-experience principles this brief must honor (from SPEC §4)

- Built for a phone in sunlight, one-handed, mid-round: big tap targets, high contrast, no precision gestures.
- One scorekeeper per foursome enters hole-by-hole — this screen is that person's tool.
- Complexity lives in the app: the scorekeeper enters gross strokes and taps do-overs; the app computes net, dots, and match state. No math on the course.

---

## Scope — Part A: Seed a demo round (so there's something to score)

To score a real 18, the app needs a round, a course, and two duos wired up. Because the admin panel doesn't exist yet (M3), seed this via a committed SQL migration + a small seed script — this is demo scaffolding, clearly marked, that the admin panel will later replace.

- Seed **one course** with one tee set: realistic rating/slope/par and a valid 18-hole `stroke_index` (use a real local course's card, or a sensible default — Chris can correct later). Par per hole included so net math and the scorecard display are real.
- Seed **one `shamble` round** in the Year One season on that course/tee.
- Seed **two teams**, four `team_members` total split across them (pull four real names from the existing `players` table), and **one match** (slot A) pairing one duo from each team.
- Seed the **duo linkage** (via `duo_submissions` or however Brief 2 resolved match participants) so the engine knows the four players in this match — two per duo.
- Give the four demo players **real indexes** (edit their `players.index`) so course-handicap conversion produces actual strokes on the card. (Trip-week these come from admin; for now they're demo values.)

Mark all demo seed data clearly (a comment, a `demo` flag, or a known season/round id) so it's trivially removable before real data loads.

## Scope — Part B: The scorecard screen (the heart of this brief)

A single mobile screen, reachable from the app, that lets one scorekeeper run one foursome's match. Model it on the mockup's Scorekeeper view.

**Per-hole entry**
- Shows the current hole: number, par, yardage (if seeded), stroke index.
- Lists the four players in the match, each with a stepper (− / value / +) for gross strokes. Big targets; default the value sensibly (e.g., par) so entry is fast.
- Shows each player's **dots** for the current hole — the strokes they receive there, computed live by the engine from their index + this course/tee. This is read-only; the scorekeeper never sets dots.
- **Do-over taps:** a breakfast-ball toggle (hole 1 only, enforced) and a mulligan toggle (any hole) per player, matching SPEC §2. Track usage so each is offered once per player per round; reflect used/available state. (The do-over's *effect* is simply that the entered stroke count is the post-do-over score — no separate second-score capture in this brief; reverse mulligan's two-score path is Brief 4.)
- A clear **Post hole** action that writes the four `hole_scores` rows to Supabase and advances to the next hole. Navigation to move between holes (and back, to correct an entry).

**Live match state**
- Above or below the entry area, show the live duo-match state straight from the engine: front 9 / back 9 / overall 18 — each showing up/down/all-square and thru-count, with segments marked closed when decided. This is the payoff the gate checks: enter a hole, watch it update.
- The match-state object comes from the Brief 2 engine, called with the scores entered so far. Do not recompute match logic in the UI — read it from `/engine`.

**Data flow (the architecture rule holds)**
- Writes: only raw `hole_scores` (gross strokes + do-over flags) go to the database. Nothing derived is persisted.
- Reads: pull this round's `hole_scores` + course/tee + duo assignments, feed them to the engine, render the returned state. An admin correcting a score later (future) means editing one row and everything recomputes — prove the pattern here even though the admin UI is later.

## Scope — Part C: Wiring & isolation

- The Supabase client lives in the app layer, never in `/engine`. The app fetches rows, hands plain data to the pure engine, renders the result. Keep that boundary clean.
- No realtime subscription required for M1 (that's M3 — four phones at once). Single-scorekeeper, single-device is the M1 target; a manual refresh re-reading scores is acceptable. (If a Supabase realtime subscription is trivial to add for the scorer's own view, fine, but it is not required and must not become a rabbit hole.)
- No auth/PIN yet (M3). The screen is reachable directly for now.

---

## Explicitly NOT in this brief (Brief 4 / later)

Skins · reverse mulligan two-score logic · individual net race · team standings & earned Sunday pairings · shortened-event · format allowances · realtime multi-device · PINs/auth · the admin panel · the four other app tabs (Cup, Matches, Money, More) as functional screens. If a stub nav helps Chris reach the scorecard, fine — but only the scorecard is built for real.

---

## Verification (the M1 gate)

1. On Chris's **phone**, open the scorecard for the seeded match and enter all 18 holes for four players — one-handed, legible, fast.
2. Dots display correctly per player per hole (spot-check 2–3 against a hand calc from their index + the seeded slope/rating/par/stroke-index).
3. Do-over toggles work and each is offered once per player per round.
4. As holes are posted, the F9 / B9 / 18 match state updates live and matches a hand-check of the seeded match — including a segment closing early if the scores make it so.
5. Posting writes raw `hole_scores` to Supabase (verify rows appear in the table); match state is derived, not stored.
6. No regression: the M0 roster still works; `/engine` tests still green; nothing framework-y imported into `/engine`.

**The gate is #1 + #4 together: Chris scores a real 18 and the live match state is correct.** That's M1.

## Close-out

Write a session addendum (shipped / commits / deviations / open issues / the demo-seed ids so they can be cleared later), save to the Desktop project folder and `/docs`, for Chris to upload to project knowledge. Note anything learned about the scorekeeper UX that should shape Field Test 1.

## After this brief

- **Field Test 1** (SPEC/BUILD_PLAN, Sep–Oct): take this scorecard on a real round with 2–3 buddies. Real thumbs, real sunlight — the UX failures surface here.
- **Brief 4 = the full engine (M2 gate):** skins, reverse mulligan two-score, individual race, standings + earned pairings, shortened event, allowances, and the simulated-full-trip test suite — layered onto this validated scorecard.
