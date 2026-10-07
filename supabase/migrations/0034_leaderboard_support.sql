-- Brief 34 Part A/B (migration block 2 of 2). Run after 0033. Idempotent.
--   * rounds and seasons join the realtime publication, so the leaderboard and TV board update the
--     moment the commissioner changes a round's format / tee times or records a chip-off winner or
--     declares the event shortened (the score tables, duos and mulligans were already published).
--   * seasons.event_shortened: the commissioner's explicit "Sunday can't be finished" call. The
--     shortened-event banner and the "standings after the last completed round" rule apply ONLY
--     when this is true -- never automatically just because a round is incomplete.

begin;

alter table seasons add column if not exists event_shortened boolean not null default false;

do $$
declare
  t text;
begin
  foreach t in array array['rounds', 'seasons'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- Verification: expect event_shortened present and false on every season, and BOTH tables published.
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'seasons' and column_name = 'event_shortened') as event_shortened_col,
  (select count(*) from seasons where event_shortened) as seasons_shortened,
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename in ('rounds', 'seasons')) as published_tables;

commit;
