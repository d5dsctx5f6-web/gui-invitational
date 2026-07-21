-- Matches: one duo-vs-duo match per team pairing per round (slot A or B).
-- Duo submissions: captain's blind duo picks, which resolve who actually plays each match.
-- Count-agnostic: the second player in a duo is nullable — a duo can be short a player.

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id),
  team_a_id uuid not null references teams (id),
  team_b_id uuid not null references teams (id),
  slot text not null check (slot in ('A', 'B'))
);

alter table matches enable row level security;

create policy "anon can read matches"
  on matches for select
  to anon
  using (true);

create table if not exists duo_submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id),
  team_id uuid not null references teams (id),
  captain_player_id uuid not null references players (id),
  duo_a_player_1 uuid not null references players (id),
  duo_a_player_2 uuid references players (id),
  duo_b_player_1 uuid not null references players (id),
  duo_b_player_2 uuid references players (id),
  committed_at timestamptz,
  unique (round_id, team_id)
);

alter table duo_submissions enable row level security;

create policy "anon can read duo_submissions"
  on duo_submissions for select
  to anon
  using (true);
