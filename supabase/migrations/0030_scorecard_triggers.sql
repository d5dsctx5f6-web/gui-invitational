-- Brief 33 Part A (block 3 of 5): triggers. Run after 0029. Idempotent.
--   * "updated by" is set by the database, never the client (null = service role / commissioner)
--   * scores must belong to the duo's own round, in a round of the matching format
--   * a round's format locks the moment any score exists for it

begin;

-- A4: updated-by + timestamp, on scores.
create or replace function set_score_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by_player_id := current_player_id(); -- null when written by the service role
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists hole_scores_audit on hole_scores;
create trigger hole_scores_audit before insert or update on hole_scores
  for each row execute function set_score_audit();

drop trigger if exists player_hole_scores_audit on player_hole_scores;
create trigger player_hole_scores_audit before insert or update on player_hole_scores
  for each row execute function set_score_audit();

-- A3: format + integrity, scramble scores.
create or replace function check_hole_scores_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  duo_round uuid;
  round_format text;
begin
  select round_id into duo_round from duos where id = new.duo_id;
  if duo_round is distinct from new.round_id then
    raise exception 'That score does not belong to this duo''s round.';
  end if;

  select format into round_format from rounds where id = new.round_id;
  if round_format <> 'scramble' then
    raise exception 'This round is best ball — scores belong in player_hole_scores, not hole_scores.';
  end if;

  if new.tee_shot_used_player_id is not null and not exists (
    select 1 from duos
    where id = new.duo_id and new.tee_shot_used_player_id in (player_1_id, player_2_id)
  ) then
    raise exception 'The Drives Used player must be one of the duo''s two players.';
  end if;

  return new;
end;
$$;

drop trigger if exists hole_scores_integrity on hole_scores;
create trigger hole_scores_integrity before insert or update on hole_scores
  for each row execute function check_hole_scores_integrity();

-- A3: format + integrity, best-ball scores.
create or replace function check_player_hole_scores_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  duo_round uuid;
  round_format text;
begin
  select round_id into duo_round from duos where id = new.duo_id;
  if duo_round is distinct from new.round_id then
    raise exception 'That score does not belong to this duo''s round.';
  end if;

  select format into round_format from rounds where id = new.round_id;
  if round_format <> 'best_ball' then
    raise exception 'This round is a scramble — scores belong in hole_scores, not player_hole_scores.';
  end if;

  if not exists (
    select 1 from duos where id = new.duo_id and new.player_id in (player_1_id, player_2_id)
  ) then
    raise exception 'That player is not in this duo.';
  end if;

  return new;
end;
$$;

drop trigger if exists player_hole_scores_integrity on player_hole_scores;
create trigger player_hole_scores_integrity before insert or update on player_hole_scores
  for each row execute function check_player_hole_scores_integrity();

-- Reverse-mulligan call must name the duo's own round.
create or replace function check_reverse_mulligan_round()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select round_id from duos where id = new.duo_id) is distinct from new.round_id then
    raise exception 'That reverse mulligan does not belong to this duo''s round.';
  end if;
  return new;
end;
$$;

drop trigger if exists reverse_mulligans_round_check on reverse_mulligans;
create trigger reverse_mulligans_round_check before insert or update on reverse_mulligans
  for each row execute function check_reverse_mulligan_round();

-- A2: the format locks at the first posted score.
create or replace function lock_round_format()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.format is distinct from old.format and (
    exists (select 1 from hole_scores where round_id = old.id)
    or exists (select 1 from player_hole_scores where round_id = old.id)
  ) then
    raise exception 'Format is locked — scores have been posted for this round.';
  end if;
  return new;
end;
$$;

drop trigger if exists rounds_format_lock on rounds;
create trigger rounds_format_lock before update of format on rounds
  for each row execute function lock_round_format();

-- Verification: expect 6 triggers.
select tgname from pg_trigger
where not tgisinternal and tgname in (
  'hole_scores_audit', 'player_hole_scores_audit', 'hole_scores_integrity',
  'player_hole_scores_integrity', 'reverse_mulligans_round_check', 'rounds_format_lock'
)
order by tgname;

commit;
