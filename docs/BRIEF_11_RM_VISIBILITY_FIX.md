# BRIEF 11 — FIX: REVERSE MULLIGAN VISIBILITY REGRESSION

**Project:** The GUI Invitational app · **Type:** bug fix, closes a regression from Brief 10 · **Issued:** Jul 23, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 10 shipped (score routing fix, commit `305b7d3`).
**Gate:** any signed-in player on the opposing team of an active match — not just that team's captain — can see and call the reverse mulligan (subject to the normal one-per-team-per-round availability), matching Rulebook v1.6 exactly.

---

## Context (read once)

Since Brief 10's score-routing fix, reverse mulligan calling has only been visible/available to team captains — everyone else on the team can no longer see or call it. **This is a genuine rule violation, not a UX rough edge.** Per PRODUCT_SPEC §2 and Rulebook v1.6 §5: *"One per team, not per duo: either duo can burn it"* — the RM is a team weapon usable by anyone in either of that team's two duos that round, with zero captain involvement in this specific power (captains' only jobs are draft picks and duo submissions, per Rulebook §2).

**Likely root cause:** Brief 10's identity-scoping work tightened match resolution correctly, but something in the RM-calling visibility check probably got scoped the same way — checking "is this player the team's captain" (perhaps because captain-related identity checks were fresh in context from Brief 10's `duo_submissions` work) rather than "is this player in one of this team's two duos for this match." Confirm this hypothesis against the actual code rather than assuming; the real fix depends on what's actually there.

Grounding: `PRODUCT_SPEC.md` §2 (reverse mulligan — canonical), `GUI_INVITATIONAL_RULEBOOK.md` v1.6 §5 (the human rule, unchanged since it was clarified), `BRIEF_7_M3_REALTIME_LIVE_FEATURES.md` Part E (the original RM-calling UI spec — re-read it, this brief restores what it specified, not something new).

---

## Scope — Part A: Diagnose

- Find the actual authorization/visibility check controlling who sees the "Call reverse mulligan" action and who can successfully call it.
- Confirm whether it's checking `captain_player_id` (wrong) versus checking team membership for the round (right — any player in either of the team's two duos, or arguably any player on the team roster for that round, should see it if their team is a participant in the active match).

## Scope — Part B: Fix the scope

- Correct the check so that **any signed-in player on the team that's part of this match** can see RM availability and call it — not just the captain. This matches "either duo can burn it" exactly: visibility and calling rights belong to the team, exercised by any of its players in the match, never gated on captaincy.
- Availability itself (has this team already used its one RM this round) is unchanged — that logic was correct before and after Brief 10; only the *who can act* check is being fixed.
- Confirm this still respects the existing `reverse_mulligans_one_per_team_round` unique constraint (Brief 6) as the backstop — widening *who* can call it doesn't change the *one per team per round* limit.

## Scope — Part C: Verify against the real scenario

- Hand-trace (per established practice — no borrowed player identities) at least two non-captain players in two different matches: confirm each can see and would be authorized to call their team's RM if available.
- Confirm the team's captain can *still* call it too (this isn't captain-exclusion, it's captain-inclusion-among-others).
- Confirm a player on neither team in a given match still correctly cannot call an RM for a match they're not part of (this boundary should already be correct — just confirm it wasn't accidentally widened too far in the fix).

---

## Verification

1. Non-captain players on both teams in a match can see and call their team's reverse mulligan, subject to normal availability.
2. Captains retain the same ability (no regression there).
3. A player unrelated to a given match still cannot call an RM for it.
4. The one-per-team-per-round constraint still holds — confirm a second call attempt after the first is used still fails cleanly.
5. No regression to Brief 10's score-routing fix or anything else in Briefs 6–10; engine tests still green.

## Close-out

Short session addendum (this is a small, targeted fix), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` and note this closes the regression flagged the night of Brief 10.
