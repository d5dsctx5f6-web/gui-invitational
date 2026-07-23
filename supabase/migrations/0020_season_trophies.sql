-- Brief 8 Part C: champions wall. Per the mockup, each season shows three independent trophy
-- lines (The Cup, Low Man, Skins King), each "— in play —" until admin records a winner —
-- there's no season-wide "closed" flag, each trophy is just null until it isn't. Results are
-- admin-recorded at trip's end (a simple close-out action), not derived live from match/skins
-- data — building a full standings-aggregation screen is out of scope for this brief.

alter table seasons
  add column cup_winner_team_id uuid references teams (id),
  add column individual_champion_player_id uuid references players (id),
  add column skins_king_player_id uuid references players (id);
