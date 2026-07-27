# Brief 23 — Scorecard Redesign: Ryder Cup Style · Session Addendum

**Date:** July 26, 2026

**Shipped:** a UI redesign of the live Scorecard entry screen, plus a small engine data-exposure
change. Pushed to `main`.

## Part A — diagnosis

Confirmed before building: `computeMatchState()`'s internal `resolveHole(duoANet, duoBNet)` was
already computing the correct per-hole win/loss/halve result for every hole — it's the same
function `computeSegment()` and `countHolesWon()` already call and have been tested against since
Brief 2/5. It just wasn't exposed as its own per-hole array anywhere. This was a pure
data-exposure change, exactly as the brief expected — no new match logic. Added
`resolveHoleResults()` to `engine/src/matchState.ts`, a thin wrapper that sorts and maps
`resolveHole()` over a `DuoHoleNets[]`, plus 4 dedicated tests (a mixed W/B/halved sequence, a
not-yet-scored hole resolving to `null` not a crash, the existing count-agnostic single-ball case,
and hole-order independence from input order).

`Scorecard.tsx` now derives both `computeMatchState()` and `resolveHoleResults()` from one shared
`duoHoleNets` memo, so the compact indicator (Part C) and the hole-by-hole strip (Part B) can never
drift from each other or from the engine's own match state.

## Part C — persistent compact up/down indicator

The existing F9/B9/18 `.segs` row was already always-visible and reasonably compact, but it read
as a sentence ("Team BroMei 2UP · thru 5") rather than a single-glance broadcast-style badge.
Redesigned each tile's content (kept the same 3-tile F9/B9/18 structure — didn't replace it
wholesale, per the brief's own note that this was likely a simplification, not a rebuild) into:
label, then a bold arrow-and-margin badge (▲2 / ▼1 / "AS" or "—" for all square), then a small
"thru N" / "Closed" line. Color and arrow direction are relative to **the signed-in player's own
duo**, not duo A/B literally — gold for "my duo's up or won," red for "down or lost," neutral for
even/halved. This stays outside any toggle, always rendered first, distinct from Part B's
on-demand deep dive.

## Part B — collapsible "Scorecard" view

Added a `▾/▴ Scorecard` toggle button, collapsed by default, directly below the compact indicator.
Expanded, it shows the mockup's `.holes`/`.hole.W/.L/.H` grid exactly (`docs/gui_invitational_mockup.html`
— reused the CSS pattern verbatim: 9-column grid, colored square tiles, hole number + W/L/H or ½),
built from `resolveHoleResults()` filtered to holes with a determinable result (mirrors the
mockup's own `strip` data, which also only ever lists holes actually played), labeled from the
signed-in player's own duo's perspective. The existing Running Totals card was moved from its old
always-visible position (just above the Post button) into this same collapsed section — removed
its old render entirely rather than duplicating it. Collapsed state: neither the strip nor Running
Totals renders; the entry screen is just the compact indicator, hole entry, and RM controls.

## Part D — prominent hole-winner banner

When `isEditingExisting` (the hole's already posted) and that hole has a determinable winner, a
full-width banner now renders between the hole nav row and the hole-scores card: "`{Team}` won
hole `{N}`" or "Hole `{N}` halved," colored the same gold/red/neutral scheme as Part C (gold if the
signed-in player's own duo won, red if the opponent did, neutral if halved) — visually much louder
than the small existing "Already posted — editing" badge, which stays put in the score card's
header as secondary metadata. A hole with no score yet shows no banner at all, per the brief's own
scope note.

## Verification

- `npm run lint` — clean.
- `npm test` — **97/97** (93 previous + 4 new `resolveHoleResults` tests).
- `npm run build` — clean, all 8 routes, no TypeScript errors.
- **Live-verified visually**, since `/score` requires signing in as a real named player (a line
  this project has never crossed): built a temporary QA-only route (`app/qa-scorecard/page.tsx`),
  same pattern Brief 12 used for the duo picker — rendered `<Scorecard>` directly with synthetic
  fake data (players named "QA Player One" etc., fake team/match IDs, no real identity touched),
  8 holes posted with a deliberate mix of results (4 wins, 2 losses, 2 halves for the viewing
  duo). Confirmed: entry screen collapsed by default with no clutter (no Running Totals, no hole
  strip); the compact indicator correctly showed "F9 ▲2 Closed" (a real dormie — 2-up with 1 hole
  left in the segment closes it early, exactly matching `computeSegment()`'s existing early-close
  logic, not a bug) and "B9 — thru 0"; expanding the toggle showed the hole strip exactly matching
  the synthetic data (`1 W 2 L 3 ½ 4 W 5 W 6 L 7 ½ 8 W`) plus correct Running Totals; navigating to
  posted holes correctly banner'd "QA Team Alpha won hole 1" (gold), "QA Team Bravo won hole 2"
  (red), and "Hole 3 halved" (neutral) — all three accent states confirmed by screenshot. The QA
  route was deleted before staging anything (`git status --short` confirmed no trace).
- No regression: `/score` unauthenticated still shows the real sign-in gate correctly against
  production (no crash, no console errors) — page.tsx routing itself wasn't touched this brief,
  only `Scorecard.tsx`/its CSS and the engine's data exposure.

## Out of scope, confirmed untouched

Hole entry, do-over/mulligan toggles, RM calling, posting itself (`postHole()`'s Supabase write is
byte-for-byte unchanged), `/score/page.tsx`'s routing, and every other screen.

## Open items carried forward

Unchanged from Brief 22's addendum. This brief didn't need any live write-path verification (no
write behavior changed at all — purely display/data-exposure), so it doesn't add a new pending
item to that category.

## Next

The rest of the session's backlog Chris raised (in-app Rulebook, Sunday pairings preview, Money
round-selector prominence, ledger color-coding, timezone fix, text sizing) remains queued for
follow-up briefs, per Brief 21's own scope note — none of it was touched here either. M4 — the
dress rehearsal — remains the next real milestone.
