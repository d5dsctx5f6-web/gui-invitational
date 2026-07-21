# Supabase schema

Migrations are numbered and applied in order via the Supabase SQL editor (no CLI/service-role
access wired up yet — see Brief 1/2 session addendums). Every table has RLS enabled with a
permissive anon-SELECT policy; writes go through the dashboard/service role until the auth model
lands in a later brief.

## Table → PRODUCT_SPEC mapping

| Table | Migration | PRODUCT_SPEC §2 area |
|---|---|---|
| `seasons` | `0002` | §3 champions wall — annual franchise, every table below hangs off a season |
| `players` | `0001` | Players, captains, draft — the locked 16-man roster |
| `courses` / `course_tees` | `0003` | Handicaps — course rating/slope/par/stroke-index, per-player mixed tees |
| `rounds` | `0004` | Rounds & formats — the two competitive rounds only (Friday fun round is `schedule_items`, engine never touches it) |
| `teams` / `team_members` | `0005` | Players, captains, draft — the four teams entered in admin after offline draft night |
| `matches` | `0006` | Rounds & formats — one duo-vs-duo match per team pairing per round |
| `duo_submissions` | `0006` | Duo submissions — captain's blind Duo A / Duo B picks, revealed simultaneously |
| `hole_scores` | `0007` | Do-overs, reverse mulligan two-score rule — the raw event table; `strokes` for skins/individual, `coalesce(match_strokes, strokes)` for match play |
| `reverse_mulligans` | `0008` (stub) | Reverse mulligan (team weapon) — logic deferred to Brief 3 |
| `skins_entries` | `0008` (stub) | Money — gross skins, opt-in — logic deferred to Brief 3 |
| `challenge_bets` | `0008` (stub) | Money — Challenge Ledger — logic deferred to Brief 3 |
| `schedule_items` | `0008` (stub) | Beyond scoring — schedule/itinerary, including the Friday fun round |

## Count-agnostic schema notes

- `team_members` has no CHECK forcing exactly 4 rows per team — a team can be short a player.
- `duo_submissions.duo_a_player_2` / `duo_b_player_2` are nullable — a duo can be down to one
  available player.
- Nothing in the schema requires a `hole_scores` row to exist for every player/round/hole —
  absence is just the absence of a row.
