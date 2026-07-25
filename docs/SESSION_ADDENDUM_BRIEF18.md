# Brief 18 — Fix: Null Handicap Index Producing Net > Gross · Session Addendum

**Date:** July 24, 2026

**Shipped:** a real correctness bug in live-affecting data, fixed at the canonical engine level.
Pushed to `main`.

## Part A — Diagnosis, confirmed exactly

Found exactly two call sites feeding a player's index into the handicap formula:
`app/score/page.tsx` (Scorecard's dots) and `app/leaderboard/LeaderboardScreen.tsx` (running
totals and the individual race, since Scorecard's totals are derived from the same dots). Both
did `courseHandicap(player.index ?? 0, tee)` — exactly the reported mechanism.

Confirmed against live production data:
- GreyHawk's actual tee: rating 71.4, par 72 → `rating − par = −0.6`, rounds to **−1**.
- **12 of 16 players** currently have `index: null`: Andrew Sabia, Ben Meier, Brendan Gleason,
  Cam Delaney, Dominic Ikeler, Grant Brogan, Ian Hastings, Matt Hornbecker, Matt Lacko, Rory
  Makohin, Tucker Gill, Zac Jones. Only 4 have a real index on file: Chris Deliso (9.9), CJ
  Lambrecht (8), Spencer Petersen (18), Will Petersen (4).
- For any null-index player, `courseHandicap(0, tee) = round(0 × 137/113 + (−0.6)) = −1`, which
  `strokesForHoles` turns into 0 dots on 17 holes and **−1 dot** on the single hole with stroke
  index 18 — a stroke taken away, not given. Over a full round that's exactly **net = gross + 1**,
  matching Chris's report (97→98, 96→97, 96→97) precisely.

One canonical function chain (`courseHandicap` → `playingHandicap` → `strokesForHoles` in
`engine/src/handicap.ts`) was confirmed as the only place this logic exists — no duplication to
track down, just two call sites both coercing null the same wrong way.

## Part B — Fix: a canonical null-safe function

Added `dotsForPlayer(index: number | null, tee, strokeIndexByHole, allowancePct?)` to
`engine/src/handicap.ts` rather than patching each call site's `?? 0` individually — this is now
*the* function every screen calls for dots, replacing the manual three-function chain both
`/score` and `/leaderboard` used to write out by hand.

- `index === null` → returns all-zero dots immediately. The course-handicap formula never runs.
- Any other value, including a real `0`, runs the formula exactly as before — a genuine
  confirmed-scratch golfer still legitimately gets a small negative handicap on a tee like
  GreyHawk's. The distinction is explicit (`index === null`, not falsy coercion), so a real `0`
  is never mistaken for "unknown."
- `courseHandicap`/`playingHandicap`/`strokesForHoles` themselves are untouched — still pure,
  still exactly what the existing (unmodified, still-passing) tests for them cover.

Both call sites now call `dotsForPlayer()` directly instead of chaining three functions by hand,
which also removed the duplicated chain — a smaller diff than it looks, and one less place for
this exact class of bug to recur.

## Part C — Surfaced transparently

Added a "no index" indicator everywhere dots/strokes are shown, per Brief 16's own transparency
principle:
- Scorecard's hole-entry rows: "no index on file — 0 strokes" under the player's name.
- Scorecard's Running Totals: "· no index" appended to the player's name.
- Leaderboard's individual race: "· no index" appended to the "thru N · gross ..." detail line.

Deliberately worded as neutral/expected ("no index on file"), not alarming — matches
PRODUCT_SPEC's framing that this is a normal, expected trip-week state until real indexes are
loaded, not a data-entry mistake.

## Verification

Lint, typecheck, build (all 8 routes), and `npm run test` (90/90 — 86 plus 4 new) all clean.

New engine tests in `handicap.test.ts` cover exactly the reported bug shape: null index on
GreyHawk's real tee produces all-zero dots; a real `0.0` index still runs the formula and can
legitimately go negative on the SI-18 hole; a real positive index (Chris's 9.9) is unaffected;
and a full 18-hole null-index round has net exactly equal to gross, never higher — a permanent
regression guard for this exact class of bug.

**Live-verified against real production data — the clearest evidence this session has produced:**
every one of the 12 null-index players now shows **net exactly equal to gross** on `/leaderboard`
(Cam Delaney +10/+10, Rory Makohin +24/+24, Tucker Gill +24/+24, Ben Meier +25/+25, Dominic Ikeler
+30/+30, and so on for all 12), each correctly badged "no index." The 4 real-index players show
distinct, sensible net-vs-gross gaps confirming they're completely unaffected: Spencer Petersen
(index 18) +24 gross → +3 net, Chris Deliso (9.9) +28 → +17, CJ Lambrecht (8) +19 → +10, Will
Petersen (4) +21 → +17. No console errors.

## Does anything currently displayed need a mental asterisk?

**Yes, but only until Chris reloads.** Every number this session verified was fetched *after* the
fix was deployed to the local dev server (the leaderboard recomputes from raw `hole_scores` on
every load/realtime event — there's no cached/stored "net" anywhere, so nothing needs a database
correction). But anyone who had `/leaderboard` or a Scorecard open in a browser tab *before* this
fix landed is looking at stale client-side state until they reload or a realtime event triggers a
refetch. No historical data was wrong at rest — only already-open pages need a refresh.

## Open items carried forward

Unchanged from Brief 17's addendum: migrations `0020`–`0023` still need Chris to run them; the
resubmission-before-reveal assumption from Brief 13; Brief 7's live two-device gate; Brief 9's own
live gate; ARCHITECTURE §5.

## Next

Once Chris runs the four pending migrations, the database is fully caught up. M4 — the dress
rehearsal — remains the next real milestone.
