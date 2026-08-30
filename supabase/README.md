# Supabase schema

Migrations are numbered and applied in order via the Supabase SQL editor (no migration CLI
wired up — see Brief 1/2 session addendums). Every table has RLS enabled with a permissive
anon-SELECT policy. As of Brief 6, the service role key is used server-side by the admin
panel (never exposed to the client) for corrections and setup writes.

## Table → PRODUCT_SPEC_V2 mapping

As of Brief 31 (v1.0 → v2.0 schema migration, `0025`). Retired v1.0 tables/columns —
`duo_submissions`, `skins_entries`, the old `matches` table, `rounds.format`,
`rounds.skins_buy_in` — are listed further down, not in this table; see "Retired in Brief 31"
below for why each one has no v2.0 successor.

| Table | Migration | PRODUCT_SPEC_V2 §2 area |
|---|---|---|
| `seasons` | `0002`, coin-flip/chip-off columns in `0025` | §3 champions wall — annual franchise, every table below hangs off a season. `coin_flip_winner_team_id`/`coin_flip_choice` are the one raw fact Friday's Pairings Night order derives from (store-raw-derive-everything, applied to the coin flip itself); `chip_off_winner_team_id` is a real-world event to record, not derived |
| `players` | `0001` | Players, captains, draft — the locked 16-man roster |
| `courses` / `course_tees` | `0003` | Handicaps — course rating/slope/par/stroke-index. Display-only now (course handicap conversion feeds captain intel on the Pairings Night board, never scoring — no strokes given anywhere in v2.0) |
| `rounds` | `0004`, `format` dropped in `0025` | Rounds & formats — the two competitive rounds only (Friday fun round is `schedule_items`, engine never touches it). One format now, both days — day identity comes from `rounds.date` directly, no companion column needed |
| `teams` / `team_members` | `0005`, fixed-name constraint in `0025` | Players, captains, draft — exactly **North Hedges** and **South Hedges** per season now (structural `check`/`unique`, not four admin-named teams). Eight players per team, still no CHECK forcing exactly 8 (count-agnostic, per the open question in Brief 31 about a short-handed team) |
| `duos` | `0025` | Pairings Night — round-scoped (not season-scoped; duos aren't fixed across the weekend), replaces the old `matches` table and `duo_submissions` together. Two rows sharing `round_id` + `match_slot` *are* a match — no separate table stores that pairing a second time |
| `hole_scores` | `0007`, duo-scoped shape in `0025` | Mercy rule, Drives Used — the raw event table, now one row per duo per hole (a scramble has one score per duo). `strokes` is raw and uncapped; the double-bogey cap is engine-applied at computation time, never stored. `tee_shot_used_player_id` is the Drives Used tap |
| `reverse_mulligans` | `0008` (stub), writes in `0018`, duo-scoped shape in `0025` | Reverse mulligan (the duo's weapon) — one row per call, `duo_id` is the calling duo, one per duo per round. Whatever the duo makes on the replay is the score — no divergent-score capture, unlike v1.0's `victim_player_id`/`original_holed_score` |
| `challenge_bets` | `0008` (stub), writes in `0018` | Money — the sole money mechanism now (skins retired) — proposer/acceptor scoped writes |
| `schedule_items` | `0008` (stub), read screen in Brief 8 | Beyond scoring — schedule/itinerary, including the Friday fun round and both Pairings Nights |
| `player_auth` / `player_devices` | `0013` | Player access (the PIN model) — no accounts, no email; rides on Supabase Auth anonymous sign-in so RLS can be genuinely identity-aware. `pin_hash` is never selectable directly, only via the `set_player_pin`/`verify_and_link_pin` SECURITY DEFINER functions |

### v1.0 trophy columns not yet reconciled to v2.0

`seasons.individual_champion_player_id` and `.skins_king_player_id` (added `0020`) are tied to
the v1.0 individual net race and skins — both retired. Brief 31 didn't touch them (champions
wall/trophies is a different screen's domain, out of this migration's scope) — flagged here as
a carried-forward item for whichever brief rebuilds the champions wall. `cup_winner_team_id`
survives unchanged; the Cup itself is unchanged in v2.0.

### Retired in Brief 31 (`0025`) — no v2.0 successor

| Table/column | Why |
|---|---|
| `duo_submissions` | The blind-simultaneous-reveal model it powered is gone — Pairings Night is a live, sequential, open declare-and-counter draft now. Superseded by `duos`. |
| `skins_entries` | Skins is retired — the Challenge Ledger is the sole money mechanism in v2.0. |
| `rounds.skins_buy_in` | Fed `skinsPayouts()` for a table that no longer exists. |
| `matches` (old shape) | `team_a_id`/`team_b_id`/`slot` — superseded by `duos`, which stores the pairing exactly once. |
| `rounds.format` | One format now (2-man scramble, gross, both days) — no enum needed. This also retired the Brief 17 trick where `format` doubled as day identity (shamble=Saturday, four_ball=Sunday); `rounds.date` now serves that purpose directly. |

## Writes since Brief 6

`hole_scores` inserts/updates require an authenticated (signed-in) session — see `0014`. Every
other table's writes go through the admin panel's service-role server actions (Brief 6 Part D),
which bypass RLS entirely after a passcode check in application code, not through client-side
RLS policies. `SELECT` is open to everyone — both the `anon` and `authenticated` Postgres roles
(see `0015` below; this was a real gap for a few days, not just "anon since M0").

### `0015` — the anon-only-read regression

Every `SELECT` policy from M0 through M2 was scoped `to anon` only, because until Brief 6 there
was no other role in play — every request genuinely came in as `anon`. Brief 6 added Supabase
Auth anonymous sign-in, established eagerly on every page load (`IdentityPicker`'s `useEffect`
calls `signInAnonymously()` before a player even picks their name). An anonymous session's JWT
carries `role: authenticated`, not `anon` — so from the moment a device picks up that invisible
session, every read from it was evaluated against `authenticated`-role policies, none of which
existed. RLS denial and "no rows" look identical over PostgREST, so this failed silently: the
roster (and every other table) just rendered empty, no error anywhere. `0015` widens every
existing read policy to `anon, authenticated`.

### `0016` — pgcrypto search_path gap

`0013` ran `create extension if not exists pgcrypto;` with no explicit schema, which on
Supabase lands in `extensions` by convention, not `public`. `set_player_pin()` and
`verify_and_link_pin()` are `SECURITY DEFINER` with `set search_path = public`, which excludes
`extensions` — so `crypt()`/`gen_salt()` weren't visible inside either function, surfacing as
`function gen_salt(unknown) does not exist` the first time anyone tried to set a PIN. `0016`
looks up pgcrypto's actual schema at runtime (rather than hardcoding `extensions`) and widens
both functions' `search_path` to include it.

## Writes since Brief 7

`0017` adds `hole_scores`, `reverse_mulligans`, `duo_submissions`, `skins_entries`, and
`challenge_bets` to the `supabase_realtime` publication (RLS still gates what a subscriber
actually receives — this only controls what's eligible to stream). `0018` gives each
previously-read-only stub table its first real write path, each scoped to the specific
player(s) the action belongs to rather than "any signed-in player" (unlike `hole_scores`'s
intentionally loose Brief 6 scoping):

- `reverse_mulligans` insert — any member of the *calling* team (`team_members`).
- `duo_submissions` insert/update — only that team's actual `captain_player_id`, writing only
  as themselves.
- `skins_entries` insert/delete — a player can only opt themselves in or out.
- `challenge_bets` insert — the proposer, naming themselves. Update — either named party
  (proposer or acceptor) only. Void/reassign is admin-only, through the service-role client.

**Brief 31 note:** `duo_submissions` and `skins_entries` (and their write policies above) no
longer exist as of `0025` — this section stays as accurate history of what Brief 7 built, not a
description of the current schema. `reverse_mulligans`' write policy was written for its old
`team_id`-scoped shape and needs a real captain-facing redesign against the new `duo_id` shape —
that's Brief 32's job, not reconciled here. `duos` itself ships with interim
admin/service-role-only writes (see `0025`), no RLS insert/update policy yet.

## Count-agnostic schema notes

- `team_members` has no CHECK forcing exactly 8 rows per team (was 4 pre-Brief-31) — a team can
  be short a player.
- `duos.player_2_id` is nullable (as of `0025`, replacing `duo_submissions`' equivalent
  nullable columns) — a duo can be down to one available player.
- Nothing in the schema requires a `hole_scores` row to exist for every duo/round/hole —
  absence is just the absence of a row.
