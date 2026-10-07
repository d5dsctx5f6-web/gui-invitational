-- Brief 33 Part A (block 4 of 5): QA sandbox seed. Run after 0030. Idempotent.
-- A self-contained test world: season year 1900 "QA Sandbox" (is_test), its own North Hedges /
-- South Hedges teams, and four QA players (is_test) on them. The QA round, duos and scores are
-- created by Admin -> QA sandbox -> Seed / reset, not here. Nothing here touches the 2027 season.

begin;

insert into seasons (year, name, is_test)
values (1900, 'QA Sandbox', true)
on conflict (year) do update set is_test = true;

insert into teams (season_id, name)
select s.id, n.name
from seasons s, (values ('North Hedges'), ('South Hedges')) as n(name)
where s.year = 1900 and s.is_test
on conflict (season_id, name) do nothing;

insert into players (name, is_test)
select v.name, true
from (values ('QA North 1'), ('QA North 2'), ('QA South 1'), ('QA South 2')) as v(name)
where not exists (select 1 from players p where p.name = v.name and p.is_test);

insert into team_members (team_id, player_id)
select t.id, p.id
from teams t
join seasons s on s.id = t.season_id and s.year = 1900 and s.is_test
join players p on p.is_test and p.name like 'QA ' || split_part(t.name, ' ', 1) || ' %'
on conflict do nothing;

-- Verification: expect 1 QA season, 2 QA teams, 4 QA players with 2 per team, and the real
-- 2027 season untouched (0 test players on its teams).
select
  (select count(*) from seasons where is_test) as qa_seasons,
  (select count(*) from teams t join seasons s on s.id = t.season_id where s.is_test) as qa_teams,
  (select count(*) from players where is_test) as qa_players,
  (select count(*) from team_members tm
     join teams t on t.id = tm.team_id join seasons s on s.id = t.season_id where s.is_test) as qa_roster_rows,
  (select count(*) from team_members tm
     join teams t on t.id = tm.team_id join seasons s on s.id = t.season_id
     join players p on p.id = tm.player_id where not s.is_test and p.is_test) as test_players_on_real_teams,
  (select count(*) from players where not is_test) as real_players;

commit;
