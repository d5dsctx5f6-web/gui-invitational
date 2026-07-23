# Brief 11 — RM Visibility Regression · Session Addendum

**Date:** July 23, 2026

**Shipped:** No functional change to reverse mulligan authorization — diagnosis found the
suspected captain-only regression does not exist in the code or in live production data. Added
one clarifying comment to guard against a future accidental regression. Pushed to `main`.

## Part A — Diagnosis

Searched every RM-adjacent surface for a `captain_player_id` (or any other captain) check:

- `app/score/Scorecard.tsx` — the RM-calling UI. `isDuoA`/`isDuoB`/`callingTeamId` are computed
  from `data.duoA.players.some((p) => p.id === currentPlayerId)` — membership in the **two-player
  duo actually playing this match**, both players checked equally, no captain reference anywhere.
  Confirmed via full `git log -p` on this file's whole history: it has never contained a captain
  check. Brief 10 did not touch this file at all (`git show 305b7d3 --stat` — only `app/score/page.tsx`
  and a new CSS module changed).
- `app/score/page.tsx` — Brief 10's identity resolution. `mySlot` checks both
  `duo_a_player_1`/`duo_a_player_2` (and the B equivalents) against the signed-in player's id —
  symmetric, not restricted to the first-listed player.
- RLS policies — `reverse_mulligans` insert policy (migration `0018`) checks
  `team_members.team_id = reverse_mulligans.team_id` for **any** team member, not
  `teams.captain_player_id`. SELECT policies on `matches`, `team_members`, `duo_submissions`,
  `reverse_mulligans`, `players`, `teams` are all open to `anon, authenticated` (migrations
  `0006`/`0008`/`0015`) — none scoped to captain.
- `engine/src/reverseMulligan.ts` — `reverseMulliganStatus()` keys purely on `teamId`/`roundId`,
  no player-level concept at all.

**Live data confirmation:** pulled real production `teams`, `team_members`, `duo_submissions`,
and `matches` rows via the anon key (read-only, no sign-in) and hand-traced the exact
`/score/page.tsx` resolution algorithm for three real non-captain players, none of whom are even
the first-listed player in their duo:

- **Rory Makohin** (Team Jones, duo A player 1, not captain — Zac Jones is) → resolves to the
  Deilso-v-Jones slot-A match, `isDuoB = true`, RM bar visible for Team Jones.
- **Ben Meier** (Team Deilso, duo B player 1, not captain — Chris Deliso is) → resolves to the
  slot-B match, RM bar visible for Team Deilso.
- **Brendan Gleason** (Team Deilso, duo B player 2 — neither captain nor duo-first-listed) →
  same match as Ben Meier, `isDuoA = true`, RM bar visible.

All three resolve and gain calling rights correctly under the current, already-pushed code.
Notably, **Zac Jones — Team Jones' actual captain — is duo B *player 2*, not player 1**, which
also rules out a subtler "only the first-listed player" bug: if that were broken, the real
captain would be one of the people it broke.

**Conclusion:** the hypothesized captain-only check does not exist. RM visibility and calling
rights are already correctly scoped to "either real player in the duo actively playing this
match," matching Rulebook v1.6 §5 exactly, and unaffected by Brief 10 (which only changed *which
match* a player lands on, not who can act once there).

## Part B — Hardening

Since no defect was found, no behavior changed. Added a comment directly at the
`isDuoA`/`isDuoB`/`callingTeamId` computation in `Scorecard.tsx` explaining explicitly that this
is intentionally *not* captain-gated, and specifically warning against "fixing" it into a
captain check by pattern-matching `duo_submissions`' write policies (which **are** correctly
captain-scoped, but for an unrelated reason — only the captain may submit picks). That
same-sounding-but-different scoping is the most plausible source of the suspicion behind this
brief, so it's the thing most likely to trip up a future reader too.

## Part C — Boundary verification

1. Non-captain players on both teams can see and call their team's RM — confirmed above (Rory,
   Ben, Brendan).
2. Captains retain the ability — unchanged code path, still symmetric across both duo slots.
3. A player unrelated to a match can't call an RM for it — structurally guaranteed, not just
   policy: `/score` always routes a signed-in player to *their own* resolved match only: a
   Lacko/Spenny player has no path to ever load the Deilso-v-Jones scorecard, calling UI
   included.
4. The `reverse_mulligans_one_per_team_round` unique constraint (migration `0012`, already run)
   is untouched by this brief and remains the DB-level backstop regardless of who calls.

## Verification

Lint, typecheck, build (all 7 routes), and `npm run test` (84/84) all clean. Live dev-server
smoke test of `/score`'s anonymous sign-in gate — unchanged, no console errors.

## Why this happened

Best guess, not confirmed: the commissioner (Chris) follows the same identity-squatting-avoidance
policy this project has used throughout — he can only personally PIN-sign-in as himself, and he
is a team captain. That means live testing has, so far, only ever been possible *as* a captain,
which is a natural reason to suspect (not confirm) a captain-only restriction without having
actually traced the resolution code against another real player's data, which this brief did.

## Open items carried forward

Unchanged from Brief 10's addendum:
- Migrations `0020` and `0021` still need to be run by Chris against the live Supabase project.
- Brief 7's live two-device gate and Brief 9's own live gate remain outstanding.
- No `first_tee_at` field in the schema; ARCHITECTURE §5 reconciliation still pending.

## Next

M4 — the dress rehearsal (per BUILD_PLAN) — is the next real milestone once the outstanding live
gates above are cleared.
