-- Brief 33 Part A (block 1 of 5): schema. Adds the per-round format, the QA flags, the
-- "updated by" columns, the best-ball scores table, and the two helper functions the RLS
-- policies (0029) and triggers (0030) use. No behavior changes yet: nothing is enforced until
-- 0029/0030. Idempotent. One transaction: any error rolls the whole block back.

begin;

-- A2: per-round format. Scramble stays the default; Saturday is always scramble.
alter table rounds add column if not exists format text not null default 'scramble';
alter table rounds drop constraint if exists rounds_format_check;
alter table rounds add constraint rounds_format_check check (format in ('scramble', 'best_ball'));

-- A5: QA flags. Default false, so every existing player and season stays a real one.
alter table players add column if not exists is_test boolean not null default false;
alter table seasons add column if not exists is_test boolean not null default false;

-- A4: "updated by" columns on hole_scores (set by trigger in 0030, never by the client).
alter table hole_scores add column if not exists updated_by_player_id uuid references players (id);
alter table hole_scores add column if not exists updated_at timestamptz not null default now();

-- A3: best-ball scores, one row per player per hole. strokes is raw (the cap is engine-applied).
-- A picked-up player simply has no row for that hole.
create table if not exists player_hole_scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id) on delete restrict,
  duo_id uuid not null references duos (id) on delete restrict,
  player_id uuid not null references players (id),
  hole int not null check (hole between 1 and 18),
  strokes int not null check (strokes > 0),
  updated_by_player_id uuid references players (id),
  updated_at timestamptz not null default now(),
  unique (player_id, round_id, hole)
);

create index if not exists player_hole_scores_round_idx on player_hole_scores (round_id);
create index if not exists player_hole_scores_duo_idx on player_hole_scores (duo_id);

alter table player_hole_scores enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'player_hole_scores'
  ) then
    alter publication supabase_realtime add table player_hole_scores;
  end if;
end $$;

-- The player this device is currently signed in as (null for the service role / signed out).
create or replace function current_player_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select player_id from player_devices where auth_user_id = auth.uid();
$$;

-- True when this device's player is in EITHER duo of the match the given duo belongs to
-- (the duos sharing its round + slot). Any of the four players in a match may post or edit
-- both duos' scores and log either duo's reverse mulligan.
create or replace function can_score_duo(p_duo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from player_devices pd
    join duos target on target.id = p_duo_id
    join duos d on d.round_id = target.round_id and d.match_slot = target.match_slot
    where pd.auth_user_id = auth.uid()
      and (d.player_1_id = pd.player_id or d.player_2_id = pd.player_id)
  );
$$;

revoke all on function current_player_id() from public;
revoke all on function can_score_duo(uuid) from public;
grant execute on function current_player_id() to authenticated;
grant execute on function can_score_duo(uuid) to authenticated;

-- Verification
select
  (select count(*) from information_schema.columns
    where table_schema = 'public'
      and ((table_name = 'rounds' and column_name = 'format')
        or (table_name = 'players' and column_name = 'is_test')
        or (table_name = 'seasons' and column_name = 'is_test')
        or (table_name = 'hole_scores' and column_name in ('updated_by_player_id', 'updated_at')))) as new_columns,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'player_hole_scores') as player_hole_scores_table,
  (select count(*) from pg_proc where proname in ('can_score_duo', 'current_player_id')) as helper_functions,
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'player_hole_scores') as in_realtime,
  (select string_agg(distinct format, ',') from rounds) as round_formats;

commit;
