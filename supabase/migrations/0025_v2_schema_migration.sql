-- Brief 31: schema migration, v1.0 -> v2.0 format (PRODUCT_SPEC_V2.md §2 is canonical).
-- "Almost none of v1.0's schema survives" -- see the brief's own Context section for why.
--
-- Pre-migration data check (per this brief's own Verification #1): duo_submissions (3 rows),
-- hole_scores (72), reverse_mulligans (1), and skins_entries (5) held real data -- a genuine,
-- fully-completed test round (Team Nintendo v Team BroMei, 2026-07-27), not demo/seed data.
-- Confirmed via row counts (Chris's own dashboard + an independent read-only check against the
-- live REST API) before this file was written. teams (2 rows) / team_members (4 rows) also held
-- real data for the same round -- discovered mid-migration once the new fixed-name constraint on
-- `teams` needed the two existing non-matching rows cleared first. All six tables' full contents
-- were exported (SQL dump + CSV + raw JSON) to archive/pre-v2-test-round/ in the Desktop project
-- folder (not this repo) before any DROP/DELETE below ran. Nothing here destroys data that
-- wasn't fully preserved first.

-- =====================================================================================
-- PART A.1 -- Drop entirely: mechanisms with no successor
-- =====================================================================================

-- duo_submissions: replaced by `duos` below. The blind-simultaneous-reveal model it powered
-- is gone -- Pairings Night is a live, sequential, open declare-and-counter draft now.
drop table if exists duo_submissions;

-- skins_entries: skins is retired (PRODUCT_SPEC_V2 §2 "Money" -- Challenge Ledger only).
drop table if exists skins_entries;

-- rounds.skins_buy_in: not explicitly named in the brief's drop list, but it exists purely to
-- feed skinsPayouts() for the table just dropped above -- a per-round dollar figure for a
-- mechanism that no longer exists. Dropping it alongside skins_entries rather than leaving an
-- orphaned column with no remaining purpose.
alter table rounds drop column if exists skins_buy_in;

-- matches (old shape): a "match" is now just two duos sharing a round and a slot -- storing
-- that pairing a second time risks the two disagreeing. No successor table by this name;
-- derive a match from `duos` (two rows sharing round_id + match_slot).
drop table if exists matches;

-- rounds.format: one format now (2-man scramble, gross, both days). This also retires the
-- Brief 17 trick where format determined the day (shamble=Saturday, four_ball=Sunday) for
-- tee-time slotting -- day identity now comes from rounds.date directly, which was already a
-- real calendar date and needs no companion column to disambiguate Saturday from Sunday.
alter table rounds drop column if exists format;

-- =====================================================================================
-- PART A.2 -- Modify: teams / team_members (four teams -> two, fixed names)
-- =====================================================================================

-- Two teams per season, not four -- North Hedges and South Hedges, a fixed identity every
-- year, not admin-editable text (PRODUCT_SPEC_V2 §2). The two existing team rows ("Team
-- Nintendo" / "Team BroMei", the same stale test-round remnant flagged in the file header
-- comment, fully archived) don't match the new fixed names and have to clear before the
-- constraint below can apply.
delete from team_members;
delete from teams;

alter table teams
  add constraint teams_name_check check (name in ('North Hedges', 'South Hedges')),
  add constraint teams_season_name_unique unique (season_id, name);

-- team_members needs no structural change -- it was already count-agnostic (no CHECK forcing
-- a member count). Eight players per team now, not four; still no CHECK forcing exactly 8,
-- per this brief's own open question about a team short a player on trip day.

-- =====================================================================================
-- PART A.3 -- New: duos (round-scoped, replaces matches + duo_submissions together)
-- =====================================================================================

create table duos (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  player_1_id uuid not null references players (id),
  player_2_id uuid references players (id), -- nullable: count-agnostic, a duo can be short a player
  match_slot int not null check (match_slot between 1 and 4),
  is_forced bool not null default false, -- true for the auto-filled fourth match
  declared_by_captain_id uuid references players (id), -- audit/history value, not load-bearing
  unique (round_id, team_id, match_slot)
);

alter table duos enable row level security;

create policy "anon can read duos"
  on duos for select
  to anon
  using (true);

-- Interim admin/service-role-only writes for this brief -- same pattern Brief 2 used for
-- hole_scores before Brief 6 formalized identity-scoped writes. No insert/update/delete policy
-- is declared here on purpose: RLS default-denies once enabled, so only the service-role
-- client (which bypasses RLS entirely) can write until Brief 32 designs the real
-- captain-facing Pairings Night write flow.

alter publication supabase_realtime add table duos;

-- =====================================================================================
-- PART A.4 -- Modify: hole_scores (player-scoped -> duo-scoped)
-- =====================================================================================

-- The shape changes too fundamentally for an ALTER to carry old rows forward -- player_id has
-- no valid mapping to duo_id, since `duos` didn't exist when the old rows were written. The 72
-- existing rows were real test-round data, archived in full before this statement ran (see the
-- file header comment) -- nothing here is lost, just retired from the live table.
drop table if exists hole_scores;

create table hole_scores (
  id uuid primary key default gen_random_uuid(),
  duo_id uuid not null references duos (id) on delete cascade,
  round_id uuid not null references rounds (id) on delete cascade,
  hole int not null check (hole between 1 and 18),
  strokes int not null, -- raw, uncapped -- the mercy cap (par + 2) is engine-applied at
                         -- computation time, never stored (PRODUCT_SPEC_V2 §2 "Mercy rule")
  tee_shot_used_player_id uuid references players (id), -- nullable: the Drives Used tap
  unique (duo_id, round_id, hole)
);

alter table hole_scores enable row level security;

create policy "anon can read hole_scores"
  on hole_scores for select
  to anon
  using (true);

alter publication supabase_realtime add table hole_scores;

-- =====================================================================================
-- PART A.5 -- Modify: reverse_mulligans (team-scoped -> duo-scoped, one score not two)
-- =====================================================================================

-- Same reasoning as hole_scores: team_id has no valid mapping to duo_id for the one existing
-- row (a real call, hole 13, archived in full above). Drop and recreate.
drop table if exists reverse_mulligans;

create table reverse_mulligans (
  id uuid primary key default gen_random_uuid(),
  duo_id uuid not null references duos (id) on delete cascade,
  round_id uuid not null references rounds (id) on delete cascade,
  hole int not null check (hole between 1 and 18), -- which hole it was called on
  called_at timestamptz not null default now(),
  unique (duo_id, round_id) -- one per duo per round, not one per team
);

alter table reverse_mulligans enable row level security;

create policy "anon can read reverse_mulligans"
  on reverse_mulligans for select
  to anon
  using (true);

alter publication supabase_realtime add table reverse_mulligans;

-- =====================================================================================
-- PART A.6 -- New: seasons gains the coin flip + chip-off facts
-- =====================================================================================

-- store-raw-derive-everything, applied to the coin flip itself (ARCHITECTURE §3): the one
-- raw fact Friday's Pairings Night declare/counter order derives from. Sunday's order is
-- computed by reversing it, never independently stored. chip_off_winner_team_id is a real-
-- world event to record (the rare 12-12 tie), not something to derive.
alter table seasons
  add column coin_flip_winner_team_id uuid references teams (id) on delete set null,
  add column coin_flip_choice text check (coin_flip_choice in ('declare', 'counter')),
  add column chip_off_winner_team_id uuid references teams (id) on delete set null;
