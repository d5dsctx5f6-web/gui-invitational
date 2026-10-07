-- Brief 32 Part B/C: rounds gain round_number + raw tee-time storage; courses gain is_active;
-- stale pre-2027 rounds are retired; destructive FK cascades become RESTRICT.
-- Run BEFORE 0027. Safe to re-run. Wrapped in one transaction: any failure rolls everything back.

begin;

-- ---------------------------------------------------------------------------------------
-- 1. Retire stale pre-trip test rounds -- only if nothing references them.
--    Their rows were exported to archive/pre-v2-test-round/ before this ran (see the Brief 32
--    addendum). 0025 already cleared hole_scores / reverse_mulligans and created duos empty, so
--    in practice nothing references them, but the guard makes that a database fact, not an
--    assumption: a round with any duo / score / mulligan is left alone, and the NOTICE below
--    says so. Rounds on or after 2027-03-01 (the trip) are never touched.
-- ---------------------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from rounds
    where date < date '2027-03-01'
      and not exists (select 1 from duos d where d.round_id = rounds.id)
      and not exists (select 1 from hole_scores h where h.round_id = rounds.id)
      and not exists (select 1 from reverse_mulligans m where m.round_id = rounds.id)
  loop
    raise notice 'deleting stale round: %', to_jsonb(r);
    delete from rounds where id = r.id;
  end loop;

  for r in
    select * from rounds where date < date '2027-03-01'
  loop
    raise notice 'KEPT (still referenced) stale round: %', to_jsonb(r);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------
-- 2. rounds: day identity + raw tee-time storage
--    round_number: Saturday = 1, Sunday = 2. date stays the calendar date.
--    Tee times are stored raw (first tee + interval) and per-group times derived:
--    match_slot k tees off at first_tee_time + (k-1) * group_interval_minutes.
-- ---------------------------------------------------------------------------------------
alter table rounds add column if not exists round_number int;
alter table rounds add column if not exists first_tee_time timestamptz;
alter table rounds add column if not exists group_interval_minutes int not null default 10;
alter table rounds add column if not exists tee_time_note text;

alter table rounds drop constraint if exists rounds_round_number_check;
alter table rounds add constraint rounds_round_number_check
  check (round_number is null or round_number between 1 and 2);

alter table rounds drop constraint if exists rounds_group_interval_check;
alter table rounds add constraint rounds_group_interval_check
  check (group_interval_minutes between 1 and 60);

alter table rounds drop constraint if exists rounds_season_round_number_unique;
alter table rounds add constraint rounds_season_round_number_unique unique (season_id, round_number);

-- ---------------------------------------------------------------------------------------
-- 3. courses.is_active: hides retired/test courses from the admin picker without deleting.
-- ---------------------------------------------------------------------------------------
alter table courses add column if not exists is_active boolean not null default true;

-- ---------------------------------------------------------------------------------------
-- 4. FK cascades -> RESTRICT. Nothing that has scores should be deletable by accident; the
--    database enforces it, not just the app. (Constraint names are Postgres's auto-names for
--    inline `references` -- <table>_<column>_fkey -- same convention 0021 relied on.)
-- ---------------------------------------------------------------------------------------
alter table hole_scores drop constraint if exists hole_scores_duo_id_fkey;
alter table hole_scores add constraint hole_scores_duo_id_fkey
  foreign key (duo_id) references duos (id) on delete restrict;

alter table hole_scores drop constraint if exists hole_scores_round_id_fkey;
alter table hole_scores add constraint hole_scores_round_id_fkey
  foreign key (round_id) references rounds (id) on delete restrict;

alter table reverse_mulligans drop constraint if exists reverse_mulligans_duo_id_fkey;
alter table reverse_mulligans add constraint reverse_mulligans_duo_id_fkey
  foreign key (duo_id) references duos (id) on delete restrict;

alter table reverse_mulligans drop constraint if exists reverse_mulligans_round_id_fkey;
alter table reverse_mulligans add constraint reverse_mulligans_round_id_fkey
  foreign key (round_id) references rounds (id) on delete restrict;

alter table duos drop constraint if exists duos_team_id_fkey;
alter table duos add constraint duos_team_id_fkey
  foreign key (team_id) references teams (id) on delete restrict;

alter table duos drop constraint if exists duos_round_id_fkey;
alter table duos add constraint duos_round_id_fkey
  foreign key (round_id) references rounds (id) on delete restrict;

alter table rounds drop constraint if exists rounds_course_id_fkey;
alter table rounds add constraint rounds_course_id_fkey
  foreign key (course_id) references courses (id) on delete restrict;

-- Verification: every FK above should now report confdeltype = 'r' (restrict).
select conrelid::regclass as "table", conname, confdeltype as on_delete
from pg_constraint
where conname in (
  'hole_scores_duo_id_fkey', 'hole_scores_round_id_fkey',
  'reverse_mulligans_duo_id_fkey', 'reverse_mulligans_round_id_fkey',
  'duos_team_id_fkey', 'duos_round_id_fkey', 'rounds_course_id_fkey'
)
order by 1, 2;

commit;
