# Brief 21 — Skins Cross-Round Carryover + Leaderboard Toggle Fix · Session Addendum

**Date:** July 26, 2026

**Shipped:** two unrelated fixes bundled in one session — a real engine/policy change (Part A) and
a display-only bug fix (Part B). Pushed to `main`.

## Part A — Skins cross-round carryover (policy reversal)

`PRODUCT_SPEC_ADDENDUM_A.md` §2 originally read "paid nightly — each round fully independent."
Chris reversed that (documented in the addendum itself, dated Jul 26 2026): if a round ends with
skins still unclaimed — a carryover chain that ties all the way through hole 18 with no unique
winner — the unresolved value now **rolls forward into the next round's pool** rather than
voiding outright. With exactly two competitive rounds (schema-enforced: `rounds.format` is
`'shamble'` or `'four_ball'`, nothing else), this only ever matters once: Saturday's leftover into
Sunday's pool.

`computeSkins()` (`engine/src/skins.ts`) was built assuming full round independence — no
cross-round state existed. This is real engine work, not a config tweak.

### Design

- Added an optional third parameter, `carryIn = 0` — the count of unresolved skins riding in from
  a prior round's unclaimed chain. It has no hole numbers of its own (buy-ins can differ per round
  via `rounds.skins_buy_in`, so the *count* carries, not a dollar figure — see below).
- `carryIn` is absorbed entirely by whichever hole resolves first in the new round. Added a
  `carriedIn: number` field to `SkinsWin` recording how much of it that particular win absorbed
  (0 for every win except the one that catches it). `skinsWonByPlayer` and the new hole's own
  `coveredHoles` combine with it — matching the brief's own example exactly: "if Sunday's hole 1
  has a unique low-score winner, they win Saturday's carried holes' value plus hole 1's own value,
  combined."
- `skinsPayouts()` (`engine/src/moneyLedger.ts`) now multiplies `(coveredHoles.length +
  carriedIn) × dollarPerHole`, where `dollarPerHole` is still derived from *this* round's own
  `entrantCount`/`skins_buy_in` — so carried-in skins are valued at the new round's own buy-in and
  entrant pool when claimed, per the brief's explicit instruction, with no extra wiring needed
  beyond the one multiply.
- If the round *itself* also ends without ever resolving (the incoming carry is never claimed),
  it doesn't vanish silently: `SkinsResult` gained `unresolvedCarryIn`, surfacing exactly what
  arrived but was never claimed. For the last round of the trip this is the genuinely-unresolved
  edge case the brief explicitly said not to auto-resolve — "leave it as a clearly-surfaced
  unresolved amount for Chris to handle manually." No resolution mechanism was invented for it.
- **Within-round logic is untouched** — same tie/carry/void loop as before, same test behavior
  for every pre-existing scenario (all prior tests still pass with only cosmetic additions of
  `carriedIn: 0` to `toEqual` literals, since the field is always present now).

### Wiring (`app/money/MoneyScreen.tsx`)

`rounds` arrives already date-ordered (`page.tsx` queries `.order("date")`, and the schema only
ever has the two competitive rounds — no practice-round rows exist here). The per-round skins loop
now walks forward: each round's `computeSkins()` call passes the running `carryIn`, and after
computing, `carryIn` becomes that round's own `voidHoles.length` for the next iteration. For a
2-round trip this means Saturday computes with `carryIn=0`, Sunday receives Saturday's leftover.

Added two small transparency hints, not asked for explicitly but a direct extension of the
existing pattern (the screen already surfaces `voidHoles` as a hint):
- If a round received a nonzero carry-in, a hint states how many skins carried in from the prior
  pool.
- The existing "Void (tied through 18)" hint now distinguishes "carrying into next round's pool"
  (any round but the last) from "genuinely unresolved, settle manually" (the last round) — since
  after this brief, "void" no longer always means gone.
- If `unresolvedCarryIn` is ever nonzero (only possible on the last round, and only if that round
  *also* never resolves anything), a dedicated hint surfaces it separately so it's never silently
  dropped.

### Tests

Three new dedicated tests in `engine/src/skins.test.ts`:
1. A Saturday tail that never resolved rides into Sunday and is claimed by Sunday's first
   legitimate winner — asserts the combined `carriedIn` + hole-1 value.
2. A Saturday round that resolves cleanly (`voidHoles: []`) leaves Sunday byte-for-byte identical
   to calling `computeSkins()` with no `carryIn` argument at all — proving the wiring is a no-op
   when there's nothing to carry.
3. Carry-in that's still unclaimed when the receiving round itself voids is surfaced via
   `unresolvedCarryIn`, not silently dropped.

Existing `fullTrip.test.ts` assertions (`SATURDAY_SKINS.wins`) updated only to add `carriedIn: 0`
to their `toEqual` literals — no behavioral change; that fixture's own `SUNDAY_SKINS` is
deliberately still computed independently (its test title, "Sunday is an independent pool —
nothing carries," now doubles as a regression test that omitting `carryIn` reproduces prior
behavior exactly).

## Part B — Leaderboard toggle: fix which number is prominent

Confirmed against Chris's own screenshots: Brief 19's Net/Gross toggle correctly re-sorted the
Individual Race list, but the large primary badge never actually changed — it always rendered
net-to-par, with gross relegated to small secondary text regardless of toggle state.

Root cause was straightforward: `LeaderboardScreen.tsx`'s row renderer hardcoded `toPar(netToPar)`
into the primary tile and `gross {toPar(grossToPar)}` into the secondary line, never reading
`raceSort` at all. Fixed by deriving `primaryToPar`/`secondaryLabel`/`secondaryToPar` from
`raceSort` before rendering — Net mode: net prominent, "gross" secondary (unchanged from before).
Gross mode: gross prominent, "net" secondary (the fix).

Confirmed unaffected, per the brief's explicit call-outs:
- Sort order — untouched, still the same `sortedStandings` `useMemo` from Brief 19.
- The ◆ daily-low-net badge — still driven by `race.dailyLows` (net-based), no change to that
  logic at all.

## Verification

- `npm run lint` — clean.
- `npm test` — **93/93** (90 previous + 3 new cross-round carry tests).
- `npm run build` — clean, all 8 routes, no TypeScript errors.
- **Live-verified Part B against real production data** at `/leaderboard`: Net mode showed Ben
  Meier/Matt Lacko/Grant Brogan/Chris Deliso with net-to-par prominent (−2, −1, +6, +9) and
  "gross +NN" secondary, ◆ on Ben Meier and Matt Lacko. Toggling to Gross re-sorted by gross-to-par
  (Chris Deliso +31, Matt Lacko +33, Ben Meier +35, Grant Brogan +43 — ascending, correct) with the
  large badge now showing those gross values and "net ±N" as secondary text; ◆ stayed on the same
  two players. Toggling back to Net fully restored the original view. No console errors.
- **Part A could not be live-verified through the UI**: `/money` requires signing in as a named
  player (name + PIN) — this project's standing identity-squatting-avoidance policy means Claude
  Code doesn't do that (the same reason `/admin` uses a shared commissioner passcode instead of a
  player identity). Verified instead with a read-only script run against the real production
  database (anon key, `computeSkins`/`skinsPayouts` imported directly from the engine, deleted
  after the run — no trace left in `git status`): the current two live rounds are Jul 26 2026
  (`four_ball`, resolves cleanly, `voidHoles: []`) and Jul 27 2026 (`shamble`, ends with hole 18
  tied, `voidHoles: [18]`). Round 1 resolving cleanly correctly produced `carryIn=0` into round 2
  — exactly the "resolves cleanly leaves the next round unaffected" case, matching dedicated test
  #2 above on real data, not just synthetic. Neither live round currently produces a nonzero
  `carryIn`, so the "Saturday leftover claimed by Sunday's first winner" path itself is verified
  only by the dedicated engine test (#1), not by live data — there's no live round pair with an
  actual unresolved tail to observe it against yet.

## Out of scope, confirmed untouched

Brief 20's Corrections drill-down, every other admin section, the engine's within-round skins
logic (unchanged behavior, only the interface gained additive fields), and the Challenge Ledger /
running ledger sections of the Money screen.

## Open items carried forward

Chris confirming Brief 20's Corrections write path on his own device (unchanged from last
session). Migrations `0020`/`0022`/`0023` confirmed run; `0021`'s FK cascade behavior still needs
Chris to confirm via the Supabase SQL editor. Also open: the resubmission-before-reveal assumption
from Brief 13, Brief 7's live two-device gate, Brief 9's own live gate, ARCHITECTURE §5. New this
session: once a real trip produces an actual unresolved Saturday skins tail, Chris should confirm
on `/money` that it visibly carries into Sunday's pool and pays out correctly — this session
verified the mechanism via the engine directly (both synthetic tests and a live production data
run) but never through the signed-in player UI, for the identity-policy reason above.

## Not in this brief

The rest of the session's backlog (Scorecard redesign, in-app Rulebook, Sunday pairings preview,
Money round-selector prominence, ledger color-coding, timezone fix, text sizing) remains queued
for follow-up briefs per Brief 21's own scope note — none of it was touched.

## Next

M4 — the dress rehearsal — remains the next real milestone, once Chris confirms Brief 20's write
path and runs the pending migrations.
