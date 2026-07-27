# Brief 24 — Money & Leaderboard Polish · Session Addendum

**Date:** July 27, 2026

**Shipped:** three grouped polish items from the backlog queued at the end of Brief 21. Pushed to
`main`.

## Part A — Sunday pairings preview

Added a "Sunday, as it stands" card to `/leaderboard`'s Cup view (`gui_invitational_mockup.html`'s
own card pattern, reused verbatim: `.card`/`.cardhead`/`.betterms`/`.stripkey`), computed from
`computeEarnedPairings()` — unchanged, display-only usage, exactly per the brief's own instruction.

**The one real design decision**: `computeEarnedPairings()` needs a *Saturday-only* ranking, not
the whole-trip cumulative `ranking` this screen already computes for the Cup board. With only 2
rounds, "whole trip so far" and "Saturday only" are the same thing *until Sunday's own matches
start producing outcomes* — at that point the existing whole-trip ranking would start blending
Sunday's own (still-incomplete) results into what's supposed to be a pure preview of what Sunday's
seeding *should have been*, corrupting it. Fixed by tracking outcomes per-round inside `compute()`
(`outcomesByRound: Map<string, TeamMatchOutcome[]>`, alongside the existing flat `outcomes` array)
and computing a second, separate `rankTeams()` call scoped to just the shamble round's own
outcomes. `format` is fixed by day (Rulebook v1.6 — `shamble` = Saturday, `four_ball` = Sunday,
always, per Brief 17's finding that unblocks this), so finding "the shamble round" is a plain
`.find()`, no new schema needed — just added `format` to the `Round` interface and both `/leaderboard`
fetch call sites (`page.tsx`'s server fetch and `LeaderboardScreen.tsx`'s client `fetchSnapshot()`),
since neither was pulling it before.

Three states, all handled without ever fabricating an order: no shamble round yet, or fewer than
4 teams exist (`computeEarnedPairings()` throws below 4 resolvable seeds — guarded on team count
before calling it at all) → "Not yet available." A genuine seeding tie surfacing
`chipOffRequired` → "Seeds tied at N/M: Team X vs Team Y — chip-off required to lock the seed,"
consistent with how the Cup board itself already displays ties. Otherwise → "1st v 2nd — Team A v
Team B" / "3rd v 4th — Team C v Team D," with a footer note ("Projected from today's standings —
locks tonight after the last putt") making clear this is provisional, not final — no extra
"incomplete" detection needed since the note itself always applies. This is a preview only —
Chris still creates and locks Sunday's real matchups in admin himself; nothing here writes
anything.

## Part B — Money round selector, more prominent

Was a thin, muted-gray, 1px-bordered text row — easy to miss, exactly Chris's complaint. Redesigned
to the same visual weight as the home page's primary `Leaderboard →` button
(`app/page.module.css` `.leaderboardLink`): bold 2px gold borders always visible on every option
(not just the active one), the active round filled solid gold with spruce text, bigger padding and
font. Purely a CSS change (`app/money/money.module.css`) — the underlying `<a href="/money?round=…">`
links and their round-switching mechanism in `page.tsx` are completely untouched.

## Part C — Running ledger: skins vs Challenge Ledger, visually distinguished

The blended net total per player (the actual settle-up number) is unchanged — `runningLedger()`
itself wasn't touched. Added a second, small breakdown line under each player's entry showing
which sources fed that total: gold `Skins ±N` (gold is already this app's established color for
skins amounts everywhere else) and cream `Bets ±N` (this app's other primary text tone) — two
colors already load-bearing elsewhere in the palette, nothing new introduced, exactly per the
brief's own constraint. Computed the bets-only contribution via `runningLedger({}, settledBets)` —
a second call with an empty skins map is mathematically identical to "just the bets' own
contribution," since the function only ever adds the skins map once and then adds/subtracts bet
stakes on top; no engine change needed, purely a display-side computation reusing the existing
function twice. Only nonzero sources render per player (a player with only skins winnings shows
just the gold line; only bets, just the cream line), keeping it scannable rather than cluttered
with zeroes.

## Verification

- `npm run lint` — clean.
- `npm test` — **97/97**, unchanged (no engine changes at all this brief — `computeEarnedPairings()`
  and `runningLedger()` both used exactly as-is).
- `npm run build` — clean, all 8 routes, no TypeScript errors (caught and fixed one real gap during
  the build: `app/leaderboard/page.tsx`'s server-side fetch also needed `format` added to its
  `rounds` query — the client-side `fetchSnapshot()` alone wasn't enough, since `page.tsx` supplies
  the *initial* server-rendered snapshot before any client fetch runs).
- **Part A live-verified against real production data**: `/leaderboard`'s Cup view correctly shows
  "Not yet available — teams aren't fully set up" right now, since production currently has only 2
  of the eventual 4 teams seeded — a genuine real-world exercise of the team-count guard, not
  synthetic. The "determined" and "chip-off" states themselves were verified with a temporary
  fake-data QA route (`app/qa-leaderboard`, same pattern as Brief 12/23, deleted before commit):
  a 4-team synthetic shamble round correctly produced "1st v 2nd — QA Team One v QA Team Three,
  3rd v 4th — QA Team Four v QA Team Two" (confirming the per-round outcome isolation and
  head-to-head/holes-won tiebreak chain all work together correctly end to end), and a variant
  with a genuine tie between two teams correctly produced "Seeds tied at 1/2… chip-off required,"
  never fabricating an order.
- **Parts B and C live-verified visually** via a second temporary fake-data QA route
  (`app/qa-money`, deleted before commit) since `/money` requires signing in as a real named
  player — a line this project has never crossed. Confirmed the round selector's new bold gold
  treatment, and a 4-player synthetic ledger scenario (skins-only, bets-only, and one player with
  both) rendering exactly as designed: `QA Player One +60.00` with `Skins +40.00` / `Bets +20.00`
  both shown, `QA Player Four +10.00` with only `Bets +10.00` (no spurious zero-skins line), and
  two losing bettors correctly negative with only their bets breakdown. Both temp routes confirmed
  removed (`git status --short` shows no trace).

## Out of scope, confirmed untouched

`computeEarnedPairings()` and `runningLedger()` internals, Brief 21's skins carryover, Brief 22's
per-match cutoff fix, Brief 23's Scorecard redesign, and every other screen.

## Open items carried forward

Unchanged from Brief 23's addendum, plus: once production actually has all 4 teams and a
completed (or in-progress) shamble round, Chris should glance at `/leaderboard` to confirm the
live "Sunday, as it stands" card against real data — this session's live check only exercised the
"not yet available" state for real, the determined/chip-off states came from synthetic data.

## Next

This closes all three items from Brief 21's queued backlog that were grouped into this brief. The
rest of that backlog (in-app Rulebook, timezone fix, text sizing pass, the FK cascade gap, paper
backup scoping, Brief 7's live two-device gate) remains queued for follow-up sessions. M4 — the
dress rehearsal — remains the next real milestone.
