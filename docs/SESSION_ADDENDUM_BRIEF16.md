# Brief 16 — Fix: Leaderboard Score Display (To-Par, Net + Gross) · Session Addendum

**Date:** July 24, 2026

**Shipped:** the individual race now shows net-to-par (E/+N/−N) as the primary figure, with
gross-to-par alongside — restoring the mockup's original convention that Brief 14's real build
had deviated from. Pushed to `main`.

## Part A — Engine: par-played + net-to-par data

Extended `engine/src/individualRace.ts` rather than computing par-of-holes-played ad hoc in the
component, per ARCHITECTURE's "engine computes, UI renders" principle:

- `PlayerHoleNet` gained two **optional** fields, `gross?` and `par?`. Optional was the
  deliberate choice — `computeIndividualRace()` is also called from `Scorecard.tsx`'s live
  per-match running totals and from two engine test files, none of which have any use for
  par-to-date. Making the fields optional meant zero changes needed to those call sites; they
  keep working exactly as before, net-only.
- `IndividualStanding` gained `cumulativeGross` and `parPlayed`, both summed the same way as
  `cumulativeNet` (0 if a caller never supplies gross/par).
- The actual **subtraction** (`cumulativeNet - parPlayed` for net-to-par) and the "E"/"+N"/"−N"
  **string formatting** were kept in the UI component, not the engine — that's genuinely just
  presentation of two already-correct numbers, not a calculation with any risk of being wrong,
  so pushing it into the engine would have been over-engineering a display concern.

Existing tests (`individualRace.test.ts` ×2, `reverseMulligan.test.ts` ×1) that asserted the full
standings object shape via `toEqual` needed updating to include the two new fields — a real,
reviewed shape change, not a broken test. Added two new tests: one reproducing Cam Delaney's
exact hand-check from the bug report (par 4/4/5, strokes 5/5/6 → net-to-par +3, not raw +16), one
confirming gross/par default to 0 when a caller omits them.

## Part B — Leaderboard display

`LeaderboardScreen.tsx` now fetches `course_tees.par_by_hole` (already in the schema since
Brief 3/M1, just never read here) and passes `gross`/`par` into each `PlayerHoleNet` entry when
building the individual race. Net-to-par renders as the primary (larger, `.pts` tile) figure;
gross-to-par renders alongside in the smaller detail line ("thru N · gross +N"). Used the actual
Unicode minus sign (−, U+2212) for under-par values, not a hyphen, per the brief's explicit
instruction and the mockup's original convention.

**Gross-to-par vs raw gross (Part B's flagged choice):** went with gross-to-par, matching net's
formatting, per the brief's own stated default. Verified it doesn't read confusingly once built —
if anything it's more consistent having both numbers in the same E/+/− language side by side.

## Part C — Checked for consistency, left two things alone (with reasons)

- **The Cup / team standings:** already displays points (0–24 scale), never a raw stroke count —
  there's no "par" concept that applies to points at all. No change needed, none made.
- **Scorecard's Running Totals card:** still shows raw gross/net, unchanged. This is a live,
  same-match, same-hole-count reference for the scorekeeper mid-entry (all 4 players in one
  match are always posted together, so raw comparison between them is already meaningful) — a
  genuinely different use case from the trip-wide leaderboard, and exactly the case the brief
  itself flagged as "arguably fine as raw." Left as-is deliberately, not overlooked.

## Verification

Lint, typecheck, build (all 8 routes), and `npm run test` (86/86 — 84 plus 2 new) all clean.

**Live-verified against real production data:** Cam Delaney now shows **+3** on `/leaderboard`,
not the previously-reported **+16** — confirmed via the exact same hand-calculation the brief
specifies (par 4/4/5, strokes 5/5/6, 0 dots → net-to-par = 16 − 13 = 3). Confirmed the "E" (even)
case renders correctly for several players currently at even. Confirmed gross and net diverge
correctly for a player with a real handicap (Chris Deliso: gross +2, net +1 — his handicap stroke
makes net the better number, as it should). Confirmed The Cup tab is unaffected, including still
correctly rendering a chip-off bucket. No console errors.

**Ranking order:** deliberately unchanged — still sorts by raw `cumulativeNet` ascending, per the
brief's explicit "same ordering logic as before, just displayed correctly." Not something this
brief asked to fix, so it wasn't touched.

## Open items carried forward

Unchanged from Brief 15's addendum: migrations `0020`/`0021`/`0022` still need Chris to run them;
Part C (Sunday pairings preview) from Brief 14 still deferred; Brief 7's live two-device gate
(now covering `/leaderboard`'s realtime); the resubmission-before-reveal assumption from
Brief 13; Brief 9's own live gate; no `first_tee_at`; ARCHITECTURE §5.

## Next

Once Chris runs the three pending migrations, the database is fully caught up. M4 — the dress
rehearsal — remains the next real milestone after that.
