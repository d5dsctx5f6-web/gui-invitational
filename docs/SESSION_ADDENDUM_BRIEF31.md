# Brief 31 — Schema + Engine Migration (v1.0 → v2.0 format) · Session Addendum

**Date:** August 29, 2026

**Status:** backend complete, pushed to `origin/main` at Chris's direction — a temporarily red
Vercel build is expected until Brief 32+ rebuilds the four affected screens (see "Build
status"). Chris runs the actual migration in the Supabase SQL editor next.

Read `PRODUCT_SPEC_V2.md` §2 in full before writing any code, per the brief's own instruction,
not just the brief's summary of it. This is the largest brief in the project's history —
almost the entire v1.0 engine and schema is retired, not adapted.

## Verification, item by item (per the brief's own Verification section)

### 1. Row counts before dropping/altering anything with existing rows

**Handled across the two prior turns, before this session's schema/engine work started.**
Confirmed real data, not demo: `duo_submissions` 3, `hole_scores` 72, `reverse_mulligans` 1,
`skins_entries` 5 — a genuine, fully-completed test round (Team Nintendo v Team BroMei,
2026-07-27), not the Deliso-v-Jones round `0022`'s own comment referenced (that one was
already cleaned up back in Brief 15). Full contents of all four tables — plus `teams` and
`team_members`, discovered mid-migration to also need clearing for the new fixed-name
constraint — exported to `archive/pre-v2-test-round/` in the Desktop project folder (SQL dump,
per-table CSVs, raw JSON, a name-resolved summary, and a README) before any DROP/DELETE ran.
Chris confirmed the export before this session's DROP statements were written.

### 2. Migrations apply cleanly; RLS present on new/changed tables

Not run — per this project's standing convention, migrations are written by me but always run
by Chris himself via the Supabase SQL editor, never applied directly from here. `0025_v2_schema_migration.sql`
is written and staged. Every new/recreated table (`duos`, `hole_scores`, `reverse_mulligans`)
gets RLS enabled with an anon-select policy, matching the established pattern; `duos` and the
recreated `hole_scores`/`reverse_mulligans` are re-added to the `supabase_realtime` publication
(dropping a table silently removes it from the publication; recreating one does not silently
re-add it — confirmed this explicitly rather than assuming). I can't confirm "applies cleanly"
from here without write access — that's Chris's own run, same as every migration before it.

### 3. `npx vitest` green, including every new test category

**60/60 passing, 11 test files** (down from 97/13 — the old suite covered a large amount of
logic that no longer exists). Every category the brief asked for is covered:
- Full 18-hole duo-vs-duo scramble match, F9/B9/18, including early-close (`fullTrip.test.ts`,
  `matchState.test.ts`).
- Mercy cap: capped for match purposes, raw input proven untouched (`matchState.test.ts`'s
  dedicated cap tests + `mercyCap.test.ts` + the `fullTrip.test.ts` integration case).
- Reverse mulligan: one score in, one score out, no divergent-score branch left to test against
  (`reverseMulligan.test.ts` + `fullTrip.test.ts`'s RM section).
- Two-team standings: points tally correctly; a genuine 12-12-style tie (points AND holes won
  both dead level) correctly flags `chipOffRequired` rather than auto-resolving
  (`standings.test.ts`).
- Pairings order derivation: Friday's 3-cycle declare/counter order from the one coin-flip
  fact, Sunday's provably the reverse of Friday's own computed result, not an independent
  second calculation (`pairings.test.ts`).
- Drives Used: correct per-player tally from raw taps (`drivesUsed.test.ts` +
  `fullTrip.test.ts`).
- Count-agnostic: a duo missing a hole score doesn't crash match-state computation
  (`matchState.test.ts` + `fullTrip.test.ts`).

Two real bugs caught and fixed during this pass, both in my own new test expectations, not the
engine: two `fullTrip.test.ts` assertions assumed a 3-hole lead stays open through hole 9, but
`computeSegment`'s existing early-close logic (unchanged since before this brief) correctly
closes it at hole 7 once the lead is mathematically insurmountable — my hand-check was wrong,
the engine wasn't. And a mercy-cap test I wrote initially assumed the cap could turn an
outright loss into a win, which is mathematically impossible (capping only ever moves a score
*down* to par+2, so the best a capped side can ever achieve is a halve, never a win over an
opponent who's also within the cap) — rewrote that test to prove what's actually true: the cap
limits damage, it doesn't manufacture a win.

### 4. Zero framework/Supabase imports in `/engine`

Confirmed by listing every distinct import source across `engine/src/**/*.ts` — every one is
either a relative local module or `vitest` (the test runner, same as before this brief). No
`next`, `react`, `@supabase/*`, or any other framework import anywhere. Isolation rule holds.

### 5. `courseHandicap()` call sites

Grepped the whole repo. **Zero remaining call sites inside match-state computation** — in fact,
zero call sites *anywhere* outside `handicap.ts`'s own definition and `handicap.test.ts`'s
tests. It was never wired into `matchState.ts` (confirmed by reading that file, not just
grepping) and isn't called from any `app/` screen either, since the Pairings Night board that's
meant to display it as captain intel doesn't exist yet — that's Brief 32. Strengthened
`handicap.ts`'s own module comment into an explicit "DISPLAY ONLY — DO NOT WIRE THIS INTO
SCORING" boundary block, per the brief's own instruction that this needs to be a comment/module
split, not just convention.

### 6. The exact diff — dropped / kept / new

**Schema (`0025_v2_schema_migration.sql`):**

| | Table/column | Fate |
|---|---|---|
| Dropped, no successor | `duo_submissions` | Superseded by `duos` |
| Dropped, no successor | `skins_entries` | Skins retired |
| Dropped, no successor | `matches` (old shape) | Superseded by `duos` |
| Dropped column | `rounds.format` | One format now |
| Dropped column | `rounds.skins_buy_in` | Fed a now-gone skins payout — **not named in the brief's own drop list**, but directly orphaned by dropping `skins_entries` in this same file; flagging as my own consequential call, not silently done |
| Cleared, then constrained | `teams` / `team_members` | 2 stale test rows didn't match the new fixed names; cleared (archived first) so `check (name in ('North Hedges','South Hedges'))` + `unique (season_id, name)` could apply — **also not explicitly named in the brief**, a necessary consequence of the constraint it does ask for |
| Dropped + recreated | `hole_scores` | player-scoped → duo-scoped; no valid `player_id`→`duo_id` mapping existed for old rows |
| Dropped + recreated | `reverse_mulligans` | team-scoped → duo-scoped, two-score capture removed |
| New | `duos` | Round-scoped, replaces `matches` + `duo_submissions` together |
| New columns | `seasons.coin_flip_winner_team_id` / `.coin_flip_choice` / `.chip_off_winner_team_id` | The coin flip's one raw fact + the chip-off real-world event |
| Untouched, flagged | `seasons.individual_champion_player_id` / `.skins_king_player_id` | Orphaned by skins/individual-race retirement, but a different screen's domain (champions wall) — not touched here, flagged in `supabase/README.md` for whichever brief rebuilds that screen |

**Engine — deleted outright** (file + test): `skins.ts`, `individualRace.ts`, `config.ts`
(the format-allowance hook), `netScore.ts` (the two-score `matchScore`/`realScore` split, and
`netScore()` itself — no remaining caller once individual race and skins are both gone).

**Engine — rewritten**: `matchState.ts` (duo-scoped single `strokes` value, mercy cap applied
at comparison time, replacing "best net ball among a duo's available players"), `standings.ts`
(head-to-head tiebreaker step removed — with exactly two teams who only ever play each other,
total points *is* head-to-head, so the step was redundant, not just simplifiable),
`reverseMulligan.ts` (`teamId` → `duoId`), `pairings.ts` (**same filename, entirely different
purpose** — v1.0's `computeEarnedPairings()` is gone; this is now `fridayPairingsOrder()`/
`sundayPairingsOrder()`, deriving the declare/counter calling order from the coin flip, not
deriving who-plays-whom from standings), `handicap.ts` (kept `courseHandicap()`/`TeeSetup`
only; **deleted `playingHandicap()`/`strokesForHoles()`/`dotsForPlayer()`** — not explicitly
named in the brief, but their entire purpose was allocating strokes across holes for net
scoring, which has no meaning left once no strokes are given anywhere), `moneyLedger.ts`
(deleted `skinsPayouts()` since it depended on the deleted `SkinsWin` type; `runningLedger()`
kept but dropped its now-vestigial skins-payouts parameter — settled bets are the only money
source left).

**Engine — new**: `mercyCap.ts` (`cappedStrokes()`), `drivesUsed.ts` (`drivesUsedTally()`).

**Engine — untouched**: `shortenedEvent.ts` — genuinely didn't need a code change; it was
already generic over participants/rounds with no team-count dependency anywhere in it.

**Fixtures/scripts**: `engine/src/fixtures/fullTrip.ts` and `fullTrip.test.ts` fully rewritten
— North Hedges vs South Hedges, 8v8, one simulated round, four duo matches, each carrying one
of the brief's required plot points. **`scripts/audit-m2-trip.ts` deleted outright**, along
with its `npm run audit` entry in `package.json` — not named in the brief, but it only existed
to print the old fixture's exports (`EARNED_PAIRINGS`, `INDIVIDUAL_RACE`, `SATURDAY_SKINS`, …),
every one of which is now gone; the M2 gate it served closed long ago and has no v2.0
equivalent requested here.

## Build status — read before pushing

**`npm run lint` and `npm test` are both clean.** `npm run build` is **not** — it fails in
exactly 4 files that import the engine directly and haven't been touched, per the brief's own
"backend only, no screen changes" scope: `app/score/Scorecard.tsx`, `app/score/page.tsx`,
`app/money/MoneyScreen.tsx`, `app/leaderboard/LeaderboardScreen.tsx`. They import
`matchScore`/`realScore`/`netScore`, `computeSkins`, `computeIndividualRace`,
`computeEarnedPairings`, `skinsPayouts`, and `dotsForPlayer` — all deleted this session. I
grepped the whole `app/` tree for engine imports first: these are the *only* four files that
import from `/engine` at all — `/admin` and `/duos` don't, so they're unaffected either way.

I did not touch these four files — rebuilding them properly, on Brief 30's design system, is
explicitly Briefs 32-35's job, and patching them now would mean writing throwaway UI code
against the old visual system just to silence a build error, then redoing it for real later.
**What this means concretely**: if you push this to `main` and Vercel is watching it, the new
deployment will fail to build — Vercel does not promote a failed build, so the *currently live*
production site keeps serving the pre-Brief-31 version unaffected; nothing goes down.
**Pushed to `origin/main` at Chris's explicit direction** — a temporarily red Vercel build
until Brief 32+ rebuilds the four affected screens is expected and accepted, not a defect to
chase. Chris is running the migration himself in the Supabase SQL editor next, same as always.

## The open question from the brief — already resolved, not actually open

**Correction, not a new finding**: my report initially said this was still open. Chris flagged
that it isn't — he and the architect already settled it before this brief started: the
commissioner decides live, on the day, no fixed formula. What this brief built — no forced-8
CHECK on `team_members`, `duos.player_2_id` nullable — is exactly the right shape for that
resolution (a schema that doesn't presume a formula, so a live judgment call has somewhere to
land), and needs nothing further. Leaving this note here rather than quietly deleting the
original wrong claim, since the addendum should read as an accurate record, corrections
included.

## Verified

- `npm run lint` — clean.
- `npm test` — 60/60, 11 files.
- `npm run build` — fails in exactly the 4 files listed above; see "Build status."
- Isolation rule — zero framework/Supabase imports in `/engine`, confirmed by listing every
  distinct import source, not just spot-checking.
- `courseHandicap()` — zero call sites inside match-state computation, in fact zero call sites
  anywhere outside its own module and tests.
- `ARCHITECTURE.md` §5 reconciled to the schema actually built here (root `docs/` copy + the
  Desktop project folder mirror). `supabase/README.md`'s table-to-spec-section map rewritten
  for v2.0, with an explicit "retired in Brief 31" table and a flagged-not-fixed note on the
  orphaned champions-wall trophy columns. Noted, not fixed: `ARCHITECTURE.md` §3/§4 still
  reference the two-score rule and skins non-entrant invisibility by name — the Close-out only
  asked for §5, so those are flagged here rather than silently touched or silently left wrong.

## Next

Brief 32 — the Pairings Night board, built against this brief's `duos` schema and Brief 30's
design system together. Not blocked on anything from this brief — the short-handed-team
question was already settled going in (see above), and the schema is already shaped for it.
