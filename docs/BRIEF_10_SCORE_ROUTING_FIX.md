# BRIEF 10 — FIX: SCORE ROUTING BY SIGNED-IN PLAYER

**Project:** The GUI Invitational app · **Type:** bug fix, closes a known gap · **Issued:** Jul 22, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 9 shipped (delete/cascade, round naming, scorecard header context all live).
**Gate:** signed in as any player in any match, "Score a round" takes that player to *their own* match — not always the first row in the table. Verified across at least two different signed-in players in two different matches.

---

## Context (read once)

This is the known limitation flagged since Brief 7's addendum: *"`/score` still hardcodes 'grab the first match in the table' — fine for the realtime gate test (wants two devices on the same match) but will need a real match picker before four simultaneous foursomes each need their own live scorecard on trip day."* Chris just hit it directly: signed in as Zac Jones (in the Team Deilso v Team Jones matchup, Duo B — Will Petersen & Zac Jones), tapping "Score a round" landed him on a different matchup entirely (Team Lacko v Team Spenny) rather than his own.

This has to be fixed properly, not patched around — it's the difference between the app being usable by one tester and usable by 16 people simultaneously on trip day, which is the entire point of M3.

Grounding: `ARCHITECTURE.md` §2 (identity — the signed-in player's ID is available via the session/auth established in Brief 6), the schema (`matches`, `duo_submissions`, `team_members` — a signed-in player's team and duo assignment for a given round is derivable from existing data, no new tables needed).

---

## Scope — Part A: Derive "my match" from identity

For a signed-in player, determine which match(es) they're actually in for a given round:

- A player belongs to a team (`team_members`). A team plays in a `match` (either `team_a_id` or `team_b_id`) for a given round. Within that match, the player is in Duo A or Duo B per `duo_submissions` (if submitted) — but **the match itself is knowable even before duos are submitted**, since `matches` only needs team assignment, not duo assignment, to identify which match a player's team is in.
- So: signed-in player → their team (for the relevant season/round) → the match(es) that team is playing in that round. If a team plays in only one match per round (per the current 2-duo, 1-match-per-team-pairing structure), this resolves to exactly one match.

## Scope — Part B: Fix "Score a round" routing

- Replace whatever "grab the first match in the table" logic currently exists with the identity-derived lookup from Part A.
- **If there's ambiguity or no round/match currently active** for the signed-in player (e.g., multiple rounds exist, or they're not on any team yet), handle gracefully — a simple picker ("which round?") is an acceptable fallback if genuinely ambiguous, but the common case (one active/current round, one match for their team) should route directly with no picker needed.
- **If a player is not assigned to any team/match** (e.g., signed in as a random/unassigned identity, or admin testing), show a clear message rather than defaulting to an arbitrary match — never silently show someone else's match.

## Scope — Part C: Verify against the real scenario that surfaced this

- Sign in as a player in Team Deilso v Team Jones (e.g., Zac Jones) → confirm "Score a round" opens *that* match.
- Sign in as a player in Team Lacko v Team Spenny → confirm it opens *that* match, not Deilso v Jones.
- Confirm this holds regardless of which match was created/viewed first in the database — the routing must be identity-driven, not row-order-driven.

---

## Verification

1. Two different signed-in players, in two different matches, each land on their own match via "Score a round" — not the same match, not always the first one.
2. A player not assigned to any team/match sees a clear message, not an arbitrary match.
3. No regression: the realtime two-device gate from Brief 7 (which specifically wants two devices *on the same match*) — confirm two players *on the same team pairing* still land together correctly.
4. All other Brief 9 fixes (delete, naming, scorecard header, skins lock) still function; engine tests still green.

## Close-out

Session addendum (shipped / commits / deviations / open issues), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` — this closes the "no real match picker" item flagged since Brief 7's addendum.
