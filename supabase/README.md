# Supabase schema

Migrations are numbered and applied in order via the Supabase SQL editor (no migration CLI
wired up — see Brief 1/2 session addendums). Every table has RLS enabled with a permissive
anon-SELECT policy. As of Brief 6, the service role key is used server-side by the admin
panel (never exposed to the client) for corrections and setup writes.

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
| `reverse_mulligans` | `0008` (stub), writes in `0018` | Reverse mulligan (team weapon) — one row per call, `team_id` is the calling team |
| `skins_entries` | `0008` (stub), writes in `0018` | Money — gross skins, opt-in — a player's own toggle |
| `challenge_bets` | `0008` (stub), writes in `0018` | Money — Challenge Ledger — proposer/acceptor scoped writes |
| `schedule_items` | `0008` (stub) | Beyond scoring — schedule/itinerary, including the Friday fun round — still stub, Brief 8 |
| `player_auth` / `player_devices` | `0013` | Player access (the PIN model) — no accounts, no email; rides on Supabase Auth anonymous sign-in so RLS can be genuinely identity-aware. `pin_hash` is never selectable directly, only via the `set_player_pin`/`verify_and_link_pin` SECURITY DEFINER functions |
| `rounds.skins_buy_in` | `0019` | Money — nullable per-round buy-in; null means the Money screen shows skin counts, not dollars, per SPEC §6's "never hard-block on a pending input" |

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

## Count-agnostic schema notes

- `team_members` has no CHECK forcing exactly 4 rows per team — a team can be short a player.
- `duo_submissions.duo_a_player_2` / `duo_b_player_2` are nullable — a duo can be down to one
  available player.
- Nothing in the schema requires a `hole_scores` row to exist for every player/round/hole —
  absence is just the absence of a row.
