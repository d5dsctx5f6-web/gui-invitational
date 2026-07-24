# Brief 14 — The Live Leaderboard · Session Addendum

**Date:** July 23–24, 2026

**Shipped:** a genuinely new screen — `/leaderboard` — closing the gap Chris flagged directly:
there had never been a standings screen in the real app, despite the engine computing the Cup
race and individual net race correctly since Brief 5. Pushed to `main`.

## Part A — The Cup (team standings)

New `app/leaderboard/LeaderboardScreen.tsx` computes, from scratch, exactly what a full trip's
worth of raw rows imply: for every round with a default tee, every player's course handicap →
playing handicap → per-hole stroke allocation; for every match, the two duos' hole-by-hole net
scores (via `duo_submissions` resolving *which* players are in *which* slot, same identity
insight Brief 10 established — team membership alone doesn't disambiguate slot A from slot B);
`computeMatchState()` + `countHolesWon()` per match feed a `TeamMatchOutcome`, and every match's
outcome across every round accumulates into one `rankTeams()` call for the whole Cup.

Every `RankBucket` renders explicitly:
- A single-team bucket is a plain ranked row.
- A `chipOffRequired` bucket (`teamIds.length > 1`) renders every tied team under a shared rank
  label with a "Chip-off required: X vs Y" note — never a fabricated single order.

## Part B — Individual net race

`computeIndividualRace()` already returns `dailyLows` (ties-inclusive, per round) — no extra code
needed there. Rendered as a second view behind a tab toggle (see below), sorted low-to-high,
each daily-low player badged with a ◆. Per the brief's own instruction, ties are shown as equal
numbers on separate rows, not collapsed into a shared rank label the way team standings are —
that bucketing is specifically a title-tiebreaker (chip-off) concern, not a running-leaderboard
one, and `IndividualRaceResult` has no bucket/rank concept at all to build that from.

**Tab vs. separate screen (Part B's flagged decision):** built as a toggle within one screen
(`"The Cup"` / `"Individual race"` buttons switching a single view), not two nav destinations —
keeps this as ONE prominent entry point rather than splitting attention, per the brief's own
"either is fine, prioritize clarity" latitude.

## Part C — Sunday pairings preview: skipped, with reason

Deliberately not built. `computeEarnedPairings()` needs a `TeamRanking` computed from
*Saturday's* outcomes specifically, distinct from the Cup's whole-trip cumulative ranking — but
nothing in the schema marks which round(s) constitute "Saturday" versus "Sunday." Inferring it
from `rounds.date` ordering (e.g., "every round but the last") is a guessable convention, not a
documented one, and given the database currently holds exactly one placeholder round, there's
nothing meaningful to preview yet regardless. Guessing a convention here risks silently
mis-identifying real earned pairings once the actual schedule is entered — not worth the risk for
a brief-acknowledged "skip without guilt" item. Flagging for a future brief once the real
multi-round schedule exists and Saturday/Sunday is unambiguous.

## Part D — Realtime + home placement

- `useRealtimeRefetch` wired on `hole_scores`, `duo_submissions`, and `matches` with no column
  filter (the leaderboard spans every round, not one) — identical usage to the hook already
  proven in `/score`, `/duos`, `/money` since Brief 7, just applied unfiltered.
- **Home page:** added as its own full-width gold button — `LEADERBOARD →` — placed *above*
  "Score a round," ahead of the Duo Submissions/Money/Schedule/Champions grid entirely. Per the
  brief's own framing ("arguably more central than Score a round for anyone not currently
  scoring"), this is the single most prominent element on the home screen now, not a fifth equal
  button in the grid.
- Made the route public (no PIN sign-in gate), same as `/schedule` and `/champions` — standings
  aren't player-specific, and zero sign-in friction matters most for the screen everyone's
  expected to check constantly.

## Verification

Lint, typecheck, build (all 8 routes now), and `npm run test` (84/84) all clean.

**Live-verified against real production data**, with an unplanned but useful wrinkle: between
Brief 13 and this session, Chris had evidently been using the app for real — Team Deliso's duo
submission had a new ID and a newer `committed_at` than what I'd seen before (he re-submitted
using Brief 13's fix), and the other three teams' submissions no longer existed at all (reset,
presumably via Brief 13's new admin capability). Rather than treat this as broken, I re-queried
the actual current state directly and hand-traced the expected leaderboard against it:

- With only Team Deliso's duo picks on record, no match can resolve any hole against an
  unresolved opponent duo — correctly produces **all four teams tied at 0 points**, a single
  4-way `chipOffRequired` bucket. This is a real (not synthetic) instance of exactly the
  never-crash, never-fabricate-an-order case Part A calls for, and it rendered correctly.
- Individual race matched a hand calculation exactly: Chris Deliso first at +7 net with the ◆
  daily-low badge; Andrew Sabia, Rory Makohin, and Tucker Gill all correctly shown tied at +8
  (equal values on separate rows, no forced ordering).
- Home page: the new gold Leaderboard button renders above Score a round, correctly sized and
  placed, no console errors.

**Not independently re-verified this session:** realtime actually pushing an update to a second
device within seconds. This bundles into Brief 7's still-outstanding live two-device gate — the
hook itself is unmodified from what Briefs 7/9/10/12/13 already use, and mutating real
`hole_scores` rows just to force a local realtime test felt like the wrong tradeoff given Chris
is actively using this same production data for his real trip right now. Confirmed via code
review that the subscription is wired identically to every other screen that already uses it.

## Open items carried forward

- Part C (Sunday pairings preview) deferred — see above, revisit once a real multi-round
  schedule exists.
- Realtime confirmation for `/leaderboard` specifically rides along with Brief 7's live
  two-device gate, still pending.
- Everything else unchanged from Brief 13's addendum: the resubmission-before-reveal assumption,
  migrations `0020`/`0021`, Brief 9's own live gate, no `first_tee_at`, ARCHITECTURE §5.

## Next

M4 — the dress rehearsal — remains the next real milestone once the outstanding live gates above
are cleared. The leaderboard existing at all closes what Chris called out as the single biggest
functional gap in the app.
