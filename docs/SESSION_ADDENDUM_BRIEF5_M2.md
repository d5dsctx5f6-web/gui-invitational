# Brief 5 — Engine: Standings, Pairings, Shortened Event + the M2 Suite · Session Addendum

**Date:** July 21, 2026

**Shipped:** The scoring engine is complete. Four new modules close out the M2 scope:

- `standings.ts` — `rankTeams()`: full team ranking with the Addendum A tiebreak ladder (points → head-to-head → holes won → `chipOffRequired`), never breaking a true tie in code.
- `pairings.ts` — `computeEarnedPairings()`: 1v2/3v4 from a `TeamRanking`, or a `chipOffRequired` result naming the ambiguous seeds.
- `shortenedEvent.ts` — `isRoundComplete()` (precise, count-agnostic completeness) and `officialRounds()` (which rounds count if Sunday doesn't finish).
- `config.ts` — the allowance knob formalized: `AllowanceConfig` with a global default (100%, Addendum A) and an optional per-format override, no longer just a bare number.
- `matchState.ts` gained `countHolesWon()` for the standings tiebreaker.

**Part E — the full simulated-trip suite:** one fixture, `engine/src/fixtures/fullTrip.ts` — 16 real roster players, 4 teams, 2 distinct course setups, both rounds, duos reshuffled Sunday — asserted together in `fullTrip.test.ts`. It exercises, all at once: match state across 8 matches, team standings with both a natural tiebreaker (Saturday: Team 3 beats Team 4 on holes won) and an engineered chip-off (full trip: Team 1 = Team 3 on points *and* holes won, having never played each other), earned Sunday pairings, individual net + daily lows, gross skins with a resolving carryover chain, a non-entrant-invisibility case, and an unresolved void chain, a reverse-mulligan divergence embedded inside a real match, a do-over, the shortened-event fallback to Saturday-only standings, and the allowance config at 100% (with the isolated 90% case cross-checked from Part D). 98 tests total (77 after this brief; the fixture itself contributes the majority of Part E's assertions).

**Part F — the audit artifact:** `npm run audit` prints the entire simulated trip in human-readable form — every match's F9/B9/18, both standings tables, the cup winner (or chip-off), Sunday's pairings, all 16 players' individual net ranked low-to-high, daily lows, the skins breakdown per round (who won which holes, the carryover chain, the void tail), and the reverse-mulligan hole shown with both scores side by side.

**Commits:** `31450d7` (docs), `82d88bb` (standings/pairings/shortened-event/config), `c2a5ccb` (the full-trip suite), `50c8639` (the audit script).

## The M2 gate is not yet closed

Per the brief: "the green suite is necessary but not sufficient." **Chris still needs to run `npm run audit` and hand-check the printed numbers** against his own math before M2 is officially met. Everything on the engineering side is done and green; this last step is deliberately a human one.

## Deviations / spec ambiguities worth flagging

- **3+ way head-to-head is left unresolved by design.** `rankTeams()` only applies the head-to-head criterion to a bucket of exactly two tied teams; a 3-or-more-way points tie skips straight to holes-won. Addendum A's ladder reads as written for a pairwise tie and doesn't specify round-robin resolution for a larger tied group (a real edge case with only 4 teams and 2 rounds, but possible). Documented in `standings.ts`; worth a look before it ever matters in practice.
- **`reverse_mulligans` still has no `unique(team_id, round_id)` constraint** (flagged in the Brief 4 addendum, not yet fixed — correctly, since no RM-writing UI exists yet). Brief 5 restates this as a must-do-before-M3 item alongside revoking the interim anon-write policy on `hole_scores`.
- **Shortened-event participant lists are caller-supplied.** `isRoundComplete()` takes `RoundParticipant[]` as an input rather than deriving it — whatever wires this to the database (a later brief) needs to source that list from `team_members`/`duo_submissions` for the round in question.

## Open items

None blocking. The two must-do-before-M3 items above carry forward. ARCHITECTURE §5 reconciliation (flagged in Brief 2/3) is still pending.

## Next

**M3 — live multiplayer + admin + events**: realtime across devices, the admin panel (teams/captains/matchups/indexes/course setups/corrections/toggles), blind duo submissions, skins opt-in UI, the Challenge Ledger, schedule, champions wall. Revoke the interim `hole_scores` anon-write policy and add the `reverse_mulligans` unique constraint as part of that work.
