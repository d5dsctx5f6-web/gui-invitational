-- Brief 15: one-time cleanup of stale test hole_scores, not a schema change.
--
-- Diagnosis (see SESSION_ADDENDUM_BRIEF15.md for the full trace): the brief's own hypothesis --
-- a leftover "Cottonwood Hills (Demo)" round from the Brief 3/M1 seed migration (0011) -- does
-- NOT match reality. That demo course/teams/round no longer exist at all (already cleaned up).
-- There is exactly ONE round in the database, "GreyHawk," and it is the SAME round Chris is
-- actively scoring for real right now. Deleting the round (the brief's suggested tool) would
-- destroy his real in-progress Deliso-v-Jones data along with the stale data.
--
-- The actual, verified cause: this round's OTHER matchup, Team Lacko v Team Spenny, has a full
-- 18-hole test round entered for it from an earlier verification pass (Dominic Ikeler, Ian
-- Hastings, Spencer Petersen, Grant Brogan all have all 18 holes posted with plausible-looking
-- scores) while the Deliso-v-Jones side has 1-2 holes each, matching Chris's actual live
-- scorecard. Team Lacko and Team Spenny are real teams with a legitimate matchup this round --
-- only these 4 players' POSTED SCORES are stale, not the round, the matches, or the
-- duo_submissions structure. This deletes exactly those hole_scores rows and nothing else.

delete from hole_scores
where round_id = '76f224f9-15c6-4c1f-b0c1-e642ba978855'
  and player_id in (
    select id from players
    where name in ('Dominic Ikeler', 'Ian Hastings', 'Spencer Petersen', 'Grant Brogan')
  );

-- Same stale test pass also called a reverse mulligan (Team Spenny on Dominic Ikeler, hole 17)
-- -- confirmed via /admin's Reverse Mulligans list. Left in place, this would falsely mark
-- Team Spenny's one-per-round RM as already used, blocking them from calling a real one later
-- this round. It's tied to the same stale scoring session, not a standing structure like the
-- match/duo_submissions setup, so it's cleaned up alongside the hole_scores rows above.
delete from reverse_mulligans
where round_id = '76f224f9-15c6-4c1f-b0c1-e642ba978855'
  and team_id = 'bac5ba36-05d6-4865-8654-a71e6e284f30' -- Team Spenny
  and hole = 17;
