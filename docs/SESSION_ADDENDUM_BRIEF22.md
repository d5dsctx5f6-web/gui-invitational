# Brief 22 — Skins Opt-In Cutoff Timing · Session Addendum

**Date:** July 26, 2026

**Shipped:** a small, targeted fix. Pushed to `main`.

## Diagnosis (per the brief's own "confirm first" instruction)

The brief's working assumption was that skins opt-in "likely reuses the same deadline computation
duo submissions use" (round's earliest tee time, minus 30 minutes). That assumption doesn't hold:
`/money` had **no real cutoff computation at all**. The hint under the opt-in button was a static
string — `"Opt in before this round's first tee — not hard-blocked after"` — with no time value
computed or displayed, and `confirmOptIn()` in `MoneyScreen.tsx` performs the insert unconditionally
with zero time-based check. "Not hard-blocked" was trivially true because there was never any
blocking logic to begin with, just informational text. Duo submissions (`/duos/page.tsx`) are the
only place the round's-earliest-tee-minus-30 computation actually exists.

So this wasn't a matter of changing an existing formula — it was adding a real one where none
existed.

## The fix

Per the brief's own reasoning (skins is a per-player decision tied to a specific match with its
own `tee_time` since Brief 17, not a round-wide captain deadline), the cutoff displayed is now
**the signed-in player's own match's tee time, no offset** — resolved with the identical
team → this round's `duo_submissions` → which slot the player landed in → that slot's `matches`
row chain Brief 10 already built for `/score` routing. `app/money/page.tsx` gained
`resolveMyMatchTeeTime()`, scoped to the currently selected round only (the Skins card only ever
shows one round at a time), decoupling the `tee_time` column fetch from the core `matches` query
per the project's standing defensive pattern (a database that hasn't run migration `0023` degrades
to "unknown" rather than breaking the whole resolution).

Any step returning null — no team, no duo submission yet, player not in either slot, match not
set up, tee time not assigned — falls back to the same generic informational text
(`"Opt in before your tee time — not hard-blocked after"`), never a broken state. No enforcement
was added or changed: opt-in still isn't hard-blocked after the cutoff, matching the brief's
explicit instruction not to change enforcement strictness as a side effect.

## Confirmed unaffected

`/duos`' own round-wide earliest-tee-minus-30 deadline computation — untouched, a different file
(`app/duos/page.tsx`), not read or modified this session. It's the intentionally-kept different
behavior the brief called out (captains need real lead time; players opting into skins don't).

## Verification

- `npm run lint` — clean.
- `npm test` — 93/93, unchanged (no engine touched — this was purely a data-resolution and
  display fix).
- `npm run build` — clean, all 8 routes, no TypeScript errors.
- **Could not live-verify through the signed-in UI**: same as Brief 21's Part A, `/money`
  requires signing in as a named real player, which this project doesn't do. Verified instead with
  a read-only script against real production data (anon key, deleted after the run, no trace left
  in `git status`): both live rounds have exactly one match each (`slot A` only, no `slot B`
  submitted), both with real `tee_time` values set (`2026-07-26T09:00:00Z` and
  `2026-07-27T01:12:00Z`), and both duo submissions correctly map all 4 real entrants (Chris
  Deliso, Matt Lacko, Grant Brogan, Ben Meier) to that single match. Hand-traced the resolution
  chain for these real rows and confirmed it correctly reaches each round's real tee time with no
  offset.
- **Could not demonstrate "two players in different matches see different cutoffs" against live
  data**, since production currently has only one match per round (no second matchup posted yet)
  — nothing to observe a difference against. The resolution logic itself is structurally identical
  to `/score`'s own player→match routing (Brief 10), which *was* already proven correct against
  multiple distinct real matches in that brief's own verification — same query shape, same
  disambiguation via `duo_submissions`, just reading `tee_time` instead of scorecard data at the
  end.

## Out of scope, confirmed untouched

Duo submission deadlines, Brief 21's skins carryover and leaderboard toggle fix, the engine, and
every other admin/player screen.

## Open items carried forward

Unchanged from Brief 21's addendum. New this session: once a real trip has two matches with
different tee times posted in the same round, Chris should confirm on `/money` (signed in as
himself) that two players see visibly different cutoffs — this session could only verify the
single-match case live, plus the shared code-path argument above.

## Next

M4 — the dress rehearsal — remains the next real milestone, once Chris confirms Brief 20's write
path and runs the pending migrations (`0021` cascade behavior still needs confirming; `0020`,
`0022`, `0023` confirmed run).
