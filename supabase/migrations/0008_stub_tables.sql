-- Stub tables for Brief 3 features (skins, reverse mulligan, challenge ledger, schedule).
-- Schema only — no logic against these tables in this brief.

create table if not exists reverse_mulligans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id),
  round_id uuid not null references rounds (id),
  hole int not null check (hole between 1 and 18),
  victim_player_id uuid not null references players (id),
  original_holed_score int
);

alter table reverse_mulligans enable row level security;

create policy "anon can read reverse_mulligans"
  on reverse_mulligans for select
  to anon
  using (true);

create table if not exists skins_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id),
  round_id uuid not null references rounds (id),
  unique (player_id, round_id)
);

alter table skins_entries enable row level security;

create policy "anon can read skins_entries"
  on skins_entries for select
  to anon
  using (true);

create table if not exists challenge_bets (
  id uuid primary key default gen_random_uuid(),
  proposer_id uuid not null references players (id),
  acceptor_id uuid references players (id),
  terms text not null,
  stake numeric,
  status text not null default 'proposed',
  winner_player_id uuid references players (id)
);

alter table challenge_bets enable row level security;

create policy "anon can read challenge_bets"
  on challenge_bets for select
  to anon
  using (true);

create table if not exists schedule_items (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons (id),
  title text not null,
  starts_at timestamptz,
  notes text
);

alter table schedule_items enable row level security;

create policy "anon can read schedule_items"
  on schedule_items for select
  to anon
  using (true);
