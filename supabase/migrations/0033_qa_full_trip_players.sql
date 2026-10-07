-- Brief 34 Part E (migration block 1 of 2): the QA sandbox's full-trip roster. Brief 33 seeded 4 QA
-- players (QA North 1-2, QA South 1-2); the full-trip mode needs a real 8 v 8, so this adds QA North
-- 3-8 and QA South 3-8 and places all of them on the QA season's teams. Idempotent. QA season only:
-- nothing here touches the 2027 season or the 16 real players.

begin;

insert into players (name, is_test)
select v.name, true
from (values
  ('QA North 3'), ('QA North 4'), ('QA North 5'), ('QA North 6'), ('QA North 7'), ('QA North 8'),
  ('QA South 3'), ('QA South 4'), ('QA South 5'), ('QA South 6'), ('QA South 7'), ('QA South 8')
) as v(name)
where not exists (select 1 from players p where p.name = v.name and p.is_test);

insert into team_members (team_id, player_id)
select t.id, p.id
from teams t
join seasons s on s.id = t.season_id and s.year = 1900 and s.is_test
join players p on p.is_test and p.name like 'QA ' || split_part(t.name, ' ', 1) || ' %'
on conflict do nothing;

-- Verification: expect 16 QA players, 8 on each QA team, no test player on a real team,
-- and the 16 real players untouched.
select
  (select count(*) from players where is_test) as qa_players,
  (select count(*) from team_members tm join teams t on t.id = tm.team_id
     join seasons s on s.id = t.season_id where s.is_test and t.name = 'North Hedges') as qa_north_roster,
  (select count(*) from team_members tm join teams t on t.id = tm.team_id
     join seasons s on s.id = t.season_id where s.is_test and t.name = 'South Hedges') as qa_south_roster,
  (select count(*) from team_members tm
     join teams t on t.id = tm.team_id join seasons s on s.id = t.season_id
     join players p on p.id = tm.player_id where not s.is_test and p.is_test) as test_players_on_real_teams,
  (select count(*) from players where not is_test) as real_players;

commit;
