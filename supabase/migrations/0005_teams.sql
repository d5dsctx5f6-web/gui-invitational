-- Teams + membership. Count-agnostic: no CHECK forcing exactly 4 members —
-- a team may end up with 3 if someone's absent on trip day.

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons (id),
  name text not null,
  captain_player_id uuid references players (id)
);

alter table teams enable row level security;

create policy "anon can read teams"
  on teams for select
  to anon
  using (true);

create table if not exists team_members (
  team_id uuid not null references teams (id),
  player_id uuid not null references players (id),
  primary key (team_id, player_id)
);

alter table team_members enable row level security;

create policy "anon can read team_members"
  on team_members for select
  to anon
  using (true);
