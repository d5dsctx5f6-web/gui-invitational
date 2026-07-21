-- Hole scores: the raw event table everything else derives from.
-- match_strokes is null unless a reverse mulligan diverges it (Brief 3).
-- Skins/individual read `strokes`; the match engine reads coalesce(match_strokes, strokes).

create table if not exists hole_scores (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id),
  round_id uuid not null references rounds (id),
  hole int not null check (hole between 1 and 18),
  strokes int not null,
  match_strokes int,
  breakfast_ball bool not null default false,
  mulligan bool not null default false,
  unique (player_id, round_id, hole)
);

alter table hole_scores enable row level security;

create policy "anon can read hole_scores"
  on hole_scores for select
  to anon
  using (true);
