# BRIEF 18 — FIX: NULL HANDICAP INDEX PRODUCING NET > GROSS

**Project:** The GUI Invitational app · **Type:** bug fix, correctness-critical · **Issued:** Jul 24, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 17 shipped (tee time slotting).
**Gate:** a player with no handicap index on file always nets exactly equal to gross (zero strokes given or taken) — never higher, never lower — on every hole, every course. Players with a real index on file are completely unaffected.

---

## Context (read once)

Chris caught this comparing a completed 18-hole scorecard against admin's handicap index list. Three players with **blank/null indexes** — Ben Meier, Rory Makohin, Tucker Gill — all show **net higher than gross by exactly one stroke** (97→98, 96→97, 96→97). Net should never exceed gross from normal handicap math; strokes only ever subtract.

**Root cause (confirmed pattern from Brief 15's Cam Delaney trace, now shown to be a real bug, not just a curiosity):** `null` index is being coerced to the literal number `0` inside the course-handicap formula — `courseHandicap = round(index × slope/113 + (rating − par))`. With `index = 0`, this collapses to `round(rating − par)`. On a course/tee where rating is below par (GreyHawk's current tee appears to be exactly this, same shape as the earlier demo course), that produces a small **negative** course handicap — which correctly means "give a stroke back on the hardest hole" for a genuine scratch-or-better golfer, but is nonsensical for a player whose index is simply **unknown**.

**The real bug: null (unknown) and 0 (confirmed scratch) are being conflated.** Per PRODUCT_SPEC §2 / §6, every player is meant to eventually have a real GHIN or assigned trip index — null right now just means "not entered yet" (expected, trip-week item), and should produce **zero strokes in either direction**, not a computed plus-handicap. This affects roughly 12 of the 16 players currently, until real indexes are loaded.

Grounding: `PRODUCT_SPEC.md` §2 (handicap conversion — canonical formula), `BRIEF_2_DATA_MODEL_ENGINE_CORE.md` (where course handicap conversion was originally built), `SESSION_ADDENDUM_BRIEF15.md` (the Cam Delaney trace that first surfaced this exact mechanism, previously treated as correct-and-benign — it is not benign when it pushes net above gross).

---

## Scope — Part A: Diagnose — confirm the exact mechanism and find every call site

- Find the actual course-handicap / dots-allocation function(s) in `/engine`. Confirm: is `null`/missing index coerced to `0` via something like `index ?? 0` (or similar) before the formula runs?
- Confirm there is **one canonical function** computing this, used consistently by the scorecard's dots display, the running totals, and the leaderboard's individual race — or if it's duplicated across call sites, find every instance. The fix must apply everywhere this logic runs, not just one screen.
- Confirm GreyHawk's actual `rating`/`par` for the tee in use, and confirm `rating − par` is indeed negative — this is what turns "index treated as 0" into "player gives back a stroke" rather than "player gets nothing."

## Scope — Part B: Fix — null index means zero strokes, full stop

- Change the logic so a **null/missing index skips the course-handicap formula entirely** — not "index defaults to 0 inside the formula," but "no formula runs; this player receives zero strokes on every hole." Net must equal gross exactly for a player with no index on file, regardless of the course's rating-vs-par relationship.
- A real index of **`0.0`** (an actual confirmed scratch golfer, if that ever occurs) must still run the real formula normally — this fix is specifically about the null/missing case, not about zero being special-cased away. Distinguish `null` from `0` explicitly in the code (e.g., `index === null` vs `index === 0`), don't rely on falsy coercion which would incorrectly catch both.
- Apply the fix at the canonical function level (per Part A) so it automatically propagates to every screen reading from it — scorecard dots, running totals, leaderboard net-to-par (Brief 16).

## Scope — Part C: Surface it clearly (transparency, matching Brief 16's spirit)

- Where a player's dots/strokes are shown (scorecard, leaderboard), if they have no index on file, show a clear, non-alarming indicator — e.g., "no index — 0 strokes" or similar — so it's obvious *why* they're not receiving strokes, rather than looking like an oversight. This matches the transparency goal from Brief 16 (showing net + gross so the mechanism is visible, not a black box).

---

## Verification

1. Confirm the exact affected players/holes before fixing (Part A's diagnosis, reported clearly).
2. After the fix: Ben Meier, Rory Makohin, Tucker Gill (or whoever currently has no index) show **net exactly equal to gross** on the same completed round — 97/97, 96/96, 96/96, not 97/98 etc.
3. Chris (real index 9.9) and CJ Lambrecht (real index 8) — and Spencer Petersen (18) / Will Petersen (4) if their scores are checkable — are **unaffected**: their real course handicaps and dots compute exactly as before this fix.
4. Confirm the fix applies consistently across scorecard, running totals, and leaderboard — not just one of them.
5. No regression: all engine tests still green (add a new test covering the null-index case explicitly, since this is exactly the kind of edge case that deserves a permanent regression guard); Brief 16's to-par display still correct on top of the now-fixed net values.

## Close-out

Session addendum (shipped / commits / deviations / open issues), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md`. This is a correctness bug in live-affecting data (not just test fixtures) — note in the addendum whether any currently-displayed leaderboard/scorecard numbers need a mental asterisk until Chris reloads and confirms the fix.
