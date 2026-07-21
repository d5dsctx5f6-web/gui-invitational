# Brief 4 — Engine: Skins, Reverse Mulligan, Individual Race · Session Addendum

**Date:** July 21, 2026

**Shipped:** Three new pure engine modules, all wired into `/engine`'s public exports, encoding Addendum A's locked decisions (100% handicap allowance, gross/opt-in/paid-nightly skins, no software tie-breaking):

- `skins.ts` — `computeSkins()`: gross, opt-in, per-round pool. Non-entrant invisibility, carryover chains (including a chain that never resolves — voided cleanly, no crash), count-agnostic entrant pool.
- `reverseMulligan.ts` — `reverseMulliganStatus()`: derives team-RM availability from events alone (absence = available), keyed by team + round so it's identical from either of a team's foursomes.
- `individualRace.ts` — `computeIndividualRace()`: cumulative net across both rounds, daily low net (ties shared, never forced to one winner), mid-round-safe.
- `netScore.ts` gained `realScore()` alongside the existing `matchScore()` — the two-score rule is just "which of these two functions does this consumer call," made explicit and greppable at every call site.

16 new tests (34 total, up from 18), including the divergent reverse-mulligan test the brief called "the single most important test in the app": one dataset (X real 3 / match 5) fed simultaneously into match state (via `matchScore`), skins (via `realScore`), and the individual race (via `realScore`), asserting all three read the correct, different values from the same underlying row.

**Commits:** `1a69603` (docs: add Brief 4 and Addendum A), `4428939` (the three engine modules + tests).

## Deviations / spec ambiguities worth resolving before Brief 5

- **`reverse_mulligans` has no `unique(team_id, round_id)` constraint.** `skins_entries` got one in Brief 2 (`unique(player_id, round_id)`), but the RM stub table didn't. The engine's `reverseMulliganStatus()` correctly *reads* "one per team per round," but nothing in the schema *enforces* it — a second insert would silently make the read logic ambiguous (which event is authoritative?). Not a blocker now (no RM-writing UI exists yet — that's M3), but this should be a one-line migration before any RM-writing path ships.
- Skins' `voidHoles` output (a chain tied all the way to 18) is engine-correct per the brief, but the spec doesn't say what the *presentation* should be when a round's skins pot goes unclaimed — worth a quick confirm with Chris before Brief 5/6 UI work, purely cosmetic.

## Open items (none blocking Brief 5)

The `reverse_mulligans` unique-constraint gap above. Everything else in Brief 4's scope is complete and tested.

## Next

Brief 5 — the M2 gate: team standings rollup, earned Sunday pairings, the tiebreaker ladders (Addendum A) with "chip-off required" surfacing, shortened-event resolution, the formal allowance-% config knob, and the full simulated-full-trip test suite (16 players, both rounds, every edge together) — assembling everything from Briefs 2–4.
