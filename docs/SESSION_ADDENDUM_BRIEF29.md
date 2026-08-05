# Brief 29 — The Mercy Rule (Quadruple Bogey Cap) · Session Addendum

**Date:** July 27, 2026

**Shipped:** a new do-over-style flag, threaded through Scorecard, admin Corrections, and
`/rulebook`. Pushed to `main`.

## Part A — schema

`supabase/migrations/0024_mercy_called.sql` adds `mercy_called bool not null default false` to
`hole_scores`, following the exact `breakfast_ball`/`mulligan` pattern (0007) — no RLS change
needed, since the existing write policies (0014) are row-level, not column-specific.

## Part B — confirmed no engine change needed

Traced the actual read paths before assuming, per the brief's own instruction:
- `matchScore(score)` = `score.matchStrokes ?? score.strokes` (feeds `computeMatchState`).
- `realScore(score)` = `score.strokes` directly (feeds `computeSkins` and `computeIndividualRace`).

Mercy caps `strokes` at entry time and never touches `matchStrokes`. So for a hole with no RM in
play, `matchScore()` falls straight through to the capped `strokes` value; skins and the
individual race read `strokes` directly regardless. **Confirmed: zero engine functions needed any
change** — exactly the brief's own claim, verified against the actual code rather than assumed.
97 tests, unchanged, is itself evidence this held: no test needed updating for a mercy-aware
branch that doesn't exist.

## Part C — Scorecard UI

Added a `mercyCalled` field to `HoleEntry`/`ExistingHoleScore`, threaded through
`entriesForHole()`, `refetchHoleScores()`, and `postHole()`. A new **Mercy** chip sits alongside
the existing BB/Mull chips — reuses the identical `.chip`/`.chipAvail`/`.chipPending` styling
Brief 27 already established, no new CSS. Unlike BB/mulligan, there's no "used elsewhere" disabled
state — mercy has no per-round limit, so the chip is always tappable. Toggling on sets
`entries[playerId].strokes` to that hole's `par + 4` and flips the chip's own label to "Mercy
called" (the same pattern the Mulligan chip already uses for its own "Mull — will use"/"Mull used
on N" states — satisfies the brief's "consistent with the existing badge pattern" instruction
without inventing a separate badge element). Toggling off doesn't force the number back to
anything, and the normal steppers still work on a mercy-capped score afterward — nothing is
locked, per the brief's own explicit requirement.

**Minor unrequested cleanup along the way**: renamed the local `rmKey()` helper to `holeKey()`,
since Brief 29 needed the same `playerId:hole` composite-key lookup for mercy that the RM logic
already used — the old RM-specific name no longer matched what the function actually does now
that two unrelated features share it.

**Decoupled fetch, same standing pattern as tee_time/skins_buy_in**: `mercy_called` is fetched in
a separate query from the core `hole_scores` columns, both in the initial server-side load
(`app/score/page.tsx`) and the client-side realtime refetch — so a database that hasn't run
migration 0024 yet keeps the whole scorecard working, just with mercy always reading as `false`.
This was live-verified against real production data (see Verification below), not just reasoned
through.

## Part D — admin Corrections

Added `mercy_called: boolean` to admin's `HoleScoreRow`, the same decoupled-fetch treatment in
`loadHoleScores()`, a third checkbox in `CorrectionRow` alongside BB/Mull, and a `mercyCalled`
read/write in `correctHoleScore()` — same shape as the existing `breakfastBall`/`mulligan`
handling, nothing new invented.

## Part E — Rulebook addition

New "Calling mercy" section inserted immediately after "Do-overs" in `app/rulebook/page.tsx`'s
`SECTIONS` array, using the brief's copy verbatim. Landed cleanly on top of Brief 28's already-
expanded content (Brief 28 ran first this session) — no conflict, since Brief 28 never touched
this insertion point.

## The three stated assumptions

All three were used as given; none needed overriding, and none surfaced a real objection during
implementation:
1. **Opt-in, not automatic** — confirmed by construction: mercy is a chip the scorekeeper taps,
   never applied silently. A player can still post a higher real score if he wants.
2. **One flag, not two** — implemented as a single `mercyCalled` boolean; "calls it" vs. "picks
   up" are both just "the scorekeeper marks mercy," no second mechanism needed or built.
3. **No stroke-count floor** — no validation was added preventing mercy on, say, a 2-stroke hole;
   consistent with the brief's own "honor system, not a validation rule" framing.

## Verification

- `npm run lint` — clean.
- `npm run build` — clean, all 9 routes, no TypeScript errors.
- `npm test` — **97/97**, unchanged — direct evidence Part B's diagnosis was correct.
- **Admin Corrections live-verified against real production data**, and this caught the most
  important real-world case: production has **not** run migration 0024 yet, so `mercy_called`
  doesn't exist as a column there right now. The Corrections page still loaded completely
  normally, every player row correctly showed a new "Mercy" checkbox defaulting to unchecked —
  live proof the decoupled-fetch pattern degrades gracefully, not just a reasoned assumption.
- **Scorecard mercy behavior verified via a temporary fake-data QA route**
  (`app/qa-scorecard`, same pattern as Briefs 12/23/24/25/26, deleted before commit), since
  `/score` requires signing in as a real player: a synthetic hole 1 with one player's score
  mercy-capped at 8 (par 4 + 4) while his partner posted a real 4 correctly showed the duo **▲1
  thru 1** on the compact indicator — direct, live confirmation that duo match state uses the
  partner's better score via best-ball, exactly as Part B predicted, not just reasoned about.
  Toggling the Mercy chip live on an unposted hole correctly changed the stroke stepper from 4 to
  8 and flipped the chip label to "Mercy called."
- `/rulebook` confirmed showing all ten sections with "Calling mercy" correctly positioned
  between "Do-overs" and "The reverse mulligan."
- Both temporary artifacts (QA route, admin session) confirmed fully cleaned up —
  `git status --short` shows no trace.

## Out of scope, confirmed untouched

The engine (zero changes, per Part B), `/money`'s skins display (reads `strokes` transparently,
unaware mercy exists, exactly as designed), and every other screen.

## Open items carried forward

Unchanged from Brief 28's addendum, plus: migration `0024` needs Chris to run it — now five
migrations queued (`0020`, `0021`, `0022`, `0023`, `0024`), only `0020`/`0022`/`0023` confirmed
run so far.

## Next

Remaining queued from the original Brief 21 backlog: the FK cascade gap (team deletion orphaning
`hole_scores`), paper backup scoping, and Brief 7's live two-device gate. M4 — the dress
rehearsal — remains the next real milestone.
