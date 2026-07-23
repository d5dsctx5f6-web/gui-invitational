-- Brief 9 Part A: admin delete for courses/rounds/teams needs Postgres to actually cascade,
-- not the app hoping it deleted things in the right order across 5+ tables non-atomically.
-- Every FK below was declared inline (`references table (id)`) with no explicit constraint
-- name, so Postgres auto-named them `<table>_<column>_fkey` — that's the name every DROP
-- CONSTRAINT below targets. Dependency counts for the confirmation UI are computed
-- read-only in the app; the actual deletion is a single DELETE on the top-level row, with
-- Postgres cascading the rest atomically.
--
-- Two SET NULL cases instead of CASCADE, both deliberate: a round's default_tee_id is optional
-- — losing the specific tee (e.g. via a course_tees cascade) shouldn't force deleting the whole
-- round. A season's cup_winner_team_id is a recorded historical result — losing the team
-- shouldn't silently rewrite champions-wall history by cascading the season away too, just
-- clear the reference.

-- courses → course_tees, rounds
alter table course_tees drop constraint if exists course_tees_course_id_fkey;
alter table course_tees add constraint course_tees_course_id_fkey
  foreign key (course_id) references courses (id) on delete cascade;

alter table rounds drop constraint if exists rounds_course_id_fkey;
alter table rounds add constraint rounds_course_id_fkey
  foreign key (course_id) references courses (id) on delete cascade;

alter table rounds drop constraint if exists rounds_default_tee_id_fkey;
alter table rounds add constraint rounds_default_tee_id_fkey
  foreign key (default_tee_id) references course_tees (id) on delete set null;

-- rounds → matches, hole_scores, duo_submissions, skins_entries, reverse_mulligans
alter table matches drop constraint if exists matches_round_id_fkey;
alter table matches add constraint matches_round_id_fkey
  foreign key (round_id) references rounds (id) on delete cascade;

alter table hole_scores drop constraint if exists hole_scores_round_id_fkey;
alter table hole_scores add constraint hole_scores_round_id_fkey
  foreign key (round_id) references rounds (id) on delete cascade;

alter table duo_submissions drop constraint if exists duo_submissions_round_id_fkey;
alter table duo_submissions add constraint duo_submissions_round_id_fkey
  foreign key (round_id) references rounds (id) on delete cascade;

alter table skins_entries drop constraint if exists skins_entries_round_id_fkey;
alter table skins_entries add constraint skins_entries_round_id_fkey
  foreign key (round_id) references rounds (id) on delete cascade;

alter table reverse_mulligans drop constraint if exists reverse_mulligans_round_id_fkey;
alter table reverse_mulligans add constraint reverse_mulligans_round_id_fkey
  foreign key (round_id) references rounds (id) on delete cascade;

-- teams → team_members, matches (both sides), duo_submissions, reverse_mulligans
alter table team_members drop constraint if exists team_members_team_id_fkey;
alter table team_members add constraint team_members_team_id_fkey
  foreign key (team_id) references teams (id) on delete cascade;

alter table matches drop constraint if exists matches_team_a_id_fkey;
alter table matches add constraint matches_team_a_id_fkey
  foreign key (team_a_id) references teams (id) on delete cascade;

alter table matches drop constraint if exists matches_team_b_id_fkey;
alter table matches add constraint matches_team_b_id_fkey
  foreign key (team_b_id) references teams (id) on delete cascade;

alter table duo_submissions drop constraint if exists duo_submissions_team_id_fkey;
alter table duo_submissions add constraint duo_submissions_team_id_fkey
  foreign key (team_id) references teams (id) on delete cascade;

alter table reverse_mulligans drop constraint if exists reverse_mulligans_team_id_fkey;
alter table reverse_mulligans add constraint reverse_mulligans_team_id_fkey
  foreign key (team_id) references teams (id) on delete cascade;

alter table seasons drop constraint if exists seasons_cup_winner_team_id_fkey;
alter table seasons add constraint seasons_cup_winner_team_id_fkey
  foreign key (cup_winner_team_id) references teams (id) on delete set null;
