-- Brief 32 Part A/B: seed the two trip courses (3 tee sets), the two competitive rounds, the
-- fixed North/South team rows, and Friday's Silverado itinerary item.
-- Run AFTER 0026. Idempotent: re-running creates no duplicates.
--   * course / tee data is upserted (re-running restores the published scorecard values)
--   * rounds, teams and the schedule item are insert-if-missing, so re-running never reverts
--     an admin edit (e.g. Sunday switched to White, or a confirmed tee time)
-- Silverado gets NO course row -- it's a schedule/itinerary item only.

begin;

-- Course data assertions: the whole migration rolls back if any is false.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('O''odham Gold',   array[4,5,4,4,4,3,4,3,4,4,3,4,4,4,4,3,5,4],
                          array[379,509,417,390,356,187,427,143,412,390,217,358,356,410,425,161,534,439],
                          array[15,13,1,3,11,5,9,17,7,12,6,2,16,8,14,18,4,10], 70, 6510),
      ('Saguaro Purple', array[4,4,4,5,3,4,4,5,3,4,3,4,4,5,3,4,4,4],
                          array[443,299,383,609,159,406,305,498,130,322,194,461,457,527,233,315,372,490],
                          array[5,11,9,1,15,7,13,3,17,14,18,6,8,2,16,12,10,4], 71, 6603),
      ('Saguaro White',  array[4,4,4,5,3,4,4,5,3,4,3,4,4,5,3,4,4,4],
                          array[426,288,362,595,146,380,290,482,121,306,176,423,417,513,209,290,358,470],
                          array[5,11,9,1,15,7,13,3,17,14,18,6,8,2,16,12,10,4], 71, 6252)
    ) as v(label, pars, yards, si, par_total, yard_total)
  loop
    if array_length(t.pars, 1) <> 18 or array_length(t.yards, 1) <> 18 or array_length(t.si, 1) <> 18 then
      raise exception '% does not have 18 holes', t.label;
    end if;
    if (select sum(x) from unnest(t.pars) x) <> t.par_total then
      raise exception '% pars do not sum to %', t.label, t.par_total;
    end if;
    if (select sum(x) from unnest(t.yards) x) <> t.yard_total then
      raise exception '% yardages do not sum to %', t.label, t.yard_total;
    end if;
    if (select array_agg(x order by x) from unnest(t.si) x) <> array(select generate_series(1, 18)) then
      raise exception '% stroke index is not a permutation of 1-18', t.label;
    end if;
  end loop;
end $$;

-- Hide every pre-existing course (old test/demo courses) from the admin picker. Nothing is
-- deleted. The two trip courses are (re)activated below.
update courses
set is_active = false
where name not in ('Talking Stick Golf Club — O''odham', 'WeKoPa Golf Club — Saguaro');

insert into courses (name)
select v.name
from (values ('Talking Stick Golf Club — O''odham'), ('WeKoPa Golf Club — Saguaro')) as v(name)
where not exists (select 1 from courses c where c.name = v.name);

update courses
set is_active = true
where name in ('Talking Stick Golf Club — O''odham', 'WeKoPa Golf Club — Saguaro');

-- Tee sets (upsert on the existing unique (course_id, tee_name)).
insert into course_tees (course_id, tee_name, rating, slope, par, stroke_index, par_by_hole, yardage_by_hole)
select c.id, v.tee_name, v.rating, v.slope, v.par, v.si, v.pars, v.yards
from (values
  ('Talking Stick Golf Club — O''odham', 'Gold', 69.9, 119, 70,
    array[15,13,1,3,11,5,9,17,7,12,6,2,16,8,14,18,4,10],
    array[4,5,4,4,4,3,4,3,4,4,3,4,4,4,4,3,5,4],
    array[379,509,417,390,356,187,427,143,412,390,217,358,356,410,425,161,534,439]),
  ('WeKoPa Golf Club — Saguaro', 'Purple', 70.2, 132, 71,
    array[5,11,9,1,15,7,13,3,17,14,18,6,8,2,16,12,10,4],
    array[4,4,4,5,3,4,4,5,3,4,3,4,4,5,3,4,4,4],
    array[443,299,383,609,159,406,305,498,130,322,194,461,457,527,233,315,372,490]),
  ('WeKoPa Golf Club — Saguaro', 'White', 68.8, 125, 71,
    array[5,11,9,1,15,7,13,3,17,14,18,6,8,2,16,12,10,4],
    array[4,4,4,5,3,4,4,5,3,4,3,4,4,5,3,4,4,4],
    array[426,288,362,595,146,380,290,482,121,306,176,423,417,513,209,290,358,470])
) as v(course_name, tee_name, rating, slope, par, si, pars, yards)
join courses c on c.name = v.course_name
on conflict (course_id, tee_name) do update
set rating = excluded.rating,
    slope = excluded.slope,
    par = excluded.par,
    stroke_index = excluded.stroke_index,
    par_by_hole = excluded.par_by_hole,
    yardage_by_hole = excluded.yardage_by_hole;

-- Fixed structural teams (names are locked by the 0025 check constraint). Captains are
-- assigned in /admin, never hardcoded.
insert into teams (season_id, name)
select s.id, n.name
from seasons s, (values ('North Hedges'), ('South Hedges')) as n(name)
where s.year = 2027
on conflict (season_id, name) do nothing;

-- Rounds. Tee times are Arizona wall-clock (America/Phoenix, UTC-7 all year, no DST):
--   Sat 2027-03-27 11:00 AM = 2027-03-27T18:00:00Z ; Sun 2027-03-28 11:40 AM = 2027-03-28T18:40:00Z
insert into rounds (season_id, round_number, date, course_id, default_tee_id,
                    first_tee_time, group_interval_minutes, tee_time_note)
select s.id, 1, date '2027-03-27', c.id, t.id,
       timestamp '2027-03-27 11:00:00' at time zone 'America/Phoenix', 10, 'Pending confirmation.'
from seasons s
join courses c on c.name = 'Talking Stick Golf Club — O''odham'
join course_tees t on t.course_id = c.id and t.tee_name = 'Gold'
where s.year = 2027
on conflict (season_id, round_number) do nothing;

insert into rounds (season_id, round_number, date, course_id, default_tee_id,
                    first_tee_time, group_interval_minutes, tee_time_note)
select s.id, 2, date '2027-03-28', c.id, t.id,
       timestamp '2027-03-28 11:40:00' at time zone 'America/Phoenix', 10, 'Pending confirmation.'
from seasons s
join courses c on c.name = 'WeKoPa Golf Club — Saguaro'
join course_tees t on t.course_id = c.id and t.tee_name = 'Purple'
where s.year = 2027
on conflict (season_id, round_number) do nothing;

-- Friday's fun round: itinerary only, time TBD (booked on GolfNow ~mid-Nov).
insert into schedule_items (season_id, title, starts_at, notes)
select s.id, 'Friday fun round — Scottsdale Silverado', null,
       'Fun round, never scored. Tee time TBD — booked on GolfNow ~mid-Nov.'
from seasons s
where s.year = 2027
  and not exists (
    select 1 from schedule_items i
    where i.season_id = s.id and i.title = 'Friday fun round — Scottsdale Silverado'
  );

-- Verification: expect 2 rounds with the UTC values below, 3 tee sets, 2 teams.
select r.round_number, r.date, c.name as course, t.tee_name,
       r.first_tee_time at time zone 'UTC' as first_tee_utc, r.group_interval_minutes, r.tee_time_note
from rounds r
join courses c on c.id = r.course_id
left join course_tees t on t.id = r.default_tee_id
order by r.round_number;

select c.name, t.tee_name, t.par, t.rating, t.slope,
       (select sum(x) from unnest(t.yardage_by_hole) x) as total_yards
from course_tees t join courses c on c.id = t.course_id
where c.is_active
order by c.name, t.tee_name;

commit;
