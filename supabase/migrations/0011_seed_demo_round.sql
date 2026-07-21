-- Demo scaffolding for the M1 scorecard gate (Brief 3). NOT real trip data — the admin panel
-- (M3) replaces this entirely. Everything here is tagged "(Demo)" in its name for easy removal:
--   delete from courses where name = 'Cottonwood Hills (Demo)';  -- cascades via FKs are NOT set,
--   so clear child rows first: hole_scores (by round_id), duo_submissions, matches, team_members,
--   teams, rounds, course_tees, courses — see the Brief 3 session addendum for the exact ids.
--
-- Seeds: one course + tee, one shamble round, two 2-player demo teams, one match (slot A),
-- both teams' duo_submissions, and real course-handicap indexes on the four demo players.

with
  demo_course as (
    insert into courses (name) values ('Cottonwood Hills (Demo)')
    returning id
  ),
  demo_tee as (
    insert into course_tees (course_id, tee_name, rating, slope, par, stroke_index, par_by_hole, yardage_by_hole)
    select
      id,
      'White',
      71.4,
      128,
      72,
      array[7, 13, 1, 15, 5, 11, 17, 3, 9, 8, 14, 2, 16, 6, 12, 18, 4, 10],
      array[4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4],
      array[402, 378, 165, 512, 388, 410, 172, 545, 395, 410, 395, 180, 520, 402, 388, 165, 560, 410]
    from demo_course
    returning id as tee_id, course_id
  ),
  demo_season as (
    select id from seasons where year = 2027 limit 1
  ),
  demo_round as (
    insert into rounds (season_id, date, format, course_id, default_tee_id)
    select demo_season.id, date '2027-03-27', 'shamble', demo_tee.course_id, demo_tee.tee_id
    from demo_season, demo_tee
    returning id
  ),
  demo_team_1 as (
    insert into teams (season_id, name)
    select id, 'Demo Team 1' from demo_season
    returning id
  ),
  demo_team_2 as (
    insert into teams (season_id, name)
    select id, 'Demo Team 2' from demo_season
    returning id
  ),
  demo_player_chris as (select id from players where name = 'Chris Deliso'),
  demo_player_cj as (select id from players where name = 'CJ Lambrecht'),
  demo_player_spencer as (select id from players where name = 'Spencer Petersen'),
  demo_player_will as (select id from players where name = 'Will Petersen'),
  demo_team_members as (
    insert into team_members (team_id, player_id)
    select demo_team_1.id, demo_player_chris.id from demo_team_1, demo_player_chris
    union all
    select demo_team_1.id, demo_player_cj.id from demo_team_1, demo_player_cj
    union all
    select demo_team_2.id, demo_player_spencer.id from demo_team_2, demo_player_spencer
    union all
    select demo_team_2.id, demo_player_will.id from demo_team_2, demo_player_will
    returning team_id
  ),
  demo_match as (
    insert into matches (round_id, team_a_id, team_b_id, slot)
    select demo_round.id, demo_team_1.id, demo_team_2.id, 'A'
    from demo_round, demo_team_1, demo_team_2
    returning id
  ),
  demo_duo_team_1 as (
    insert into duo_submissions (round_id, team_id, captain_player_id, duo_a_player_1, duo_a_player_2, committed_at)
    select demo_round.id, demo_team_1.id, demo_player_chris.id, demo_player_chris.id, demo_player_cj.id, now()
    from demo_round, demo_team_1, demo_player_chris, demo_player_cj
    returning id
  ),
  demo_duo_team_2 as (
    insert into duo_submissions (round_id, team_id, captain_player_id, duo_a_player_1, duo_a_player_2, committed_at)
    select demo_round.id, demo_team_2.id, demo_player_spencer.id, demo_player_spencer.id, demo_player_will.id, now()
    from demo_round, demo_team_2, demo_player_spencer, demo_player_will
    returning id
  ),
  demo_indexes as (
    update players set index = case name
      when 'Chris Deliso' then 12.0
      when 'CJ Lambrecht' then 8.0
      when 'Spencer Petersen' then 18.0
      when 'Will Petersen' then 4.0
    end
    where name in ('Chris Deliso', 'CJ Lambrecht', 'Spencer Petersen', 'Will Petersen')
    returning id
  )
select
  (select count(*) from demo_team_members) as team_members_inserted,
  (select count(*) from demo_match) as matches_inserted,
  (select count(*) from demo_duo_team_1) as duo_team_1_inserted,
  (select count(*) from demo_duo_team_2) as duo_team_2_inserted,
  (select count(*) from demo_indexes) as indexes_updated;
