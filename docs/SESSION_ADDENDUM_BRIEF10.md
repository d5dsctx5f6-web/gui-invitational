# Brief 10 — Fix: Score Routing by Signed-In Player · Session Addendum

**Date:** July 22, 2026

**Shipped:** `/score` now routes by identity, not by "first row in the table." Pushed to `main`.
Closes the "no real match picker" item flagged in Brief 7's addendum and carried through
Brief 9's open items.

## What was actually wrong — and what the brief's own model missed

The bug Chris hit: signed in as Zac Jones (Team Jones, Duo B), "Score a round" opened Team
Lacko v Team Spenny — a matchup he's not even in. Root cause was exactly as diagnosed:
`loadScorecardData()` did `.from("matches").limit(1).maybeSingle()`, grabbing whichever match
row Postgres happened to return first, with no relationship to who was signed in.

The brief's Part A describes resolving "signed-in player → their team → the match(es) that
team is playing," and says a team pairing resolves to exactly one match. **That's not quite how
the schema actually works, and it matters:** a team pairing (e.g. Deilso v Jones) is **two**
`matches` rows — slot A and slot B — sharing the identical `team_a_id`/`team_b_id`. Team
membership alone can't tell those two rows apart, since both genuinely belong to the player's
team. Naively filtering matches by team membership (as a first pass at this fix did) returns
both rows for almost every player, and since the two rows look identical from the outside
(same opponent, same round), there's no way to build a meaningful "which one?" picker from team
membership alone — asking someone to choose between two entries labeled "Team Deilso v Team
Jones" and "Team Deilso v Team Jones" doesn't resolve anything.

**The real disambiguator is `duo_submissions`.** Each team has one `duo_submissions` row per
round listing exactly who's in Duo A and who's in Duo B. Resolution ended up three-layered:

1. **Which round** — genuinely ambiguous only if a player's team has matches recorded in more
   than one round at once (the one real fallback-to-a-picker case, and it picks a *round*, not
   a raw match row, since round labels are actually distinguishable).
2. **Which team** they're playing for in that round (from `team_members`).
3. **Which slot** (A or B) — a deterministic lookup in that round's `duo_submissions` row for
   checking whether the player's ID is in the `duo_a_*` or `duo_b_*` fields. This is what
   actually separates the two match rows sharing a team pairing.

If duos haven't been submitted yet for the resolved round, that's reported directly ("your
team's duos haven't been submitted for this round yet") rather than falling through to a
confusing generic "no match" state — a case the original single-query version couldn't
distinguish from "you're not in any matchup at all."

## Verification

Lint, typecheck, build (all 7 routes), and `npm run test` (84/84) all clean.

**Correctness was verified by hand-tracing the real production data**, not by clicking through
signed-in sessions — same reasoning as every prior brief: completing a PIN sign-in as any of
the 16 real players during automated testing would claim their identity slot, and several
already have live PINs from Chris's own testing. Instead, fetched the actual `teams`,
`matches`, `team_members`, and `duo_submissions` rows via the anon key and traced the exact
resolution logic by hand for three real players:

- **Zac Jones** (Team Jones, Duo B per `duo_submissions`) → resolves to the slot-B match
  against Team Deilso's Duo B (Ben Meier, Brendan Gleason) — the exact matchup from the bug
  report, not Team Lacko v Team Spenny.
- **Matt Lacko** (Team Lacko, Duo A) → resolves independently to the slot-A Lacko-v-Spenny
  match, confirming the fix isn't accidentally still order-dependent (Deilso-v-Jones slot A
  appears first in raw query order; Matt Lacko still lands on his own matchup regardless).
- **Ben Meier, Brendan Gleason, Will Petersen, and Zac Jones** — the four players sharing that
  one slot-B foursome — all independently resolve to the *same* match ID, confirming the
  Brief 7 realtime two-device gate (which specifically wants two devices on the same match)
  still works correctly.

Also smoke-tested `/score`, `/duos`, and `/money` against the live database via a local dev
server — no crashes, no console errors, no regressions on the sign-in gate or any other screen.

## Deviation from the brief worth flagging

Part A's framing ("the match itself is knowable... before duos are submitted, since matches
only needs team assignment") undersold the real ambiguity — team assignment narrows it to a
*pairing*, not a specific match row, whenever both slots exist. The fix leans on
`duo_submissions` for the final disambiguation rather than resolving purely from
`team_members`/`matches` as originally described. Net effect is the same behavior the brief
asked for (route directly in the common case, no picker needed), just via a slightly different
data path than Part A sketched.

## Open items carried forward

Same two noted in Brief 9's addendum, unaffected by this fix:
- No `first_tee_at` field in the schema.
- ARCHITECTURE §5 reconciliation still pending.

## Next

M4 — the dress rehearsal (per BUILD_PLAN), and Brief 7's live two-device gate, both still
outstanding and independent of this fix.
