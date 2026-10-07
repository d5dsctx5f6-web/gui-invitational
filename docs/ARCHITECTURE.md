# THE HEDGES INVITATIONAL — ARCHITECTURE

**Status:** v1.2 — decisions locked at project setup; refine details in briefs, record changes here.

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js + TypeScript**, shipped as a **PWA** | Claude Code's deepest stack; link-tap "Add to Home Screen" honors the 30-second rule |
| Data + live | **Supabase** (Postgres + Realtime; no Storage needed) | Relational scoring data + push-to-every-phone realtime, managed, free tier |
| Hosting | **Vercel** (hobby tier) | Push to git → live; Chris already uses it |
| Cost | **$0/month** | Free tiers dwarf 16 users. Quirk: free Supabase pauses after ~7 idle days → daily Vercel cron keep-alive (§7) |

## 2. Access model (zero-friction auth)

- One shared link → pick your name from the roster → set a **4-digit PIN**; device remembered thereafter. No emails, no passwords, no accounts.
- Separate **admin passcode** unlocks commissioner controls on Chris's devices.
- Threat model is 15 trusted friends; PINs prevent accidents and impersonation pranks, nothing more.

## 3. Core principle — store raw truth, derive everything

**The database stores only events; all competition state is computed.**

- Stored: hole scores, do-over uses, reverse-mulligan events (with original-score capture), skins opt-ins, challenge bets, course setups, rosters, teams, matchups, schedule.
- Derived (never persisted): match state (F9/B9/18), team points and standings, earned Sunday pairings, skins results and carryovers, individual net race, the ledger and settle-up numbers.
- Payoff: an admin correction is "edit one event → everything recomputes." No sync bugs, no stale standings, and the engine becomes pure, deterministic, and fully testable.

## 4. Scoring engine

- One isolated, pure TypeScript module: `(events, courseSetups, config) → derived state`. No I/O, no framework imports.
- Implements PRODUCT_SPEC §2 exactly, including the **two-score rule** (match score vs real score per player-hole when an RM hits a holed shot) and **non-entrant invisibility** in skins.
- Gate for M2: a **simulated full-trip test suite** — 16 players, both rounds, every edge (RM-on-mulligan, carryover chains, opt-out low scores, shortened Sunday, allowance math) — passing before any human scores a real hole.

## 5. Data model sketch (tables; v2.0 schema as of Brief 31)

`seasons` (year, name, cup_winner_team_id, coin_flip_winner_team_id, coin_flip_choice,
chip_off_winner_team_id — the coin flip is stored as one raw fact, Friday's declare/counter
order and Sunday's reversal are both derived from it, never independently stored) · `players`
(name, ghin_or_trip_index) · `teams` (season, name — fixed to **North Hedges**/**South
Hedges**, structural not admin-editable text, captain) / `team_members` (team, player —
count-agnostic, no forced-8 CHECK) · `rounds` (round_number — Saturday 1, Sunday 2, unique per
season, orders and labels rounds; date; course_id; default_tee_id — the active tee, admin-switchable
and display-only; first_tee_time + group_interval_minutes + tee_time_note — raw tee-time storage,
per-group times are derived as first_tee_time + (match_slot − 1) × interval and never stored; no
`format` column, one format now) · `courses` (name, is_active — hides retired test courses from the
admin picker) / `course_tees` (one row per tee: rating, slope, par, stroke_index[18], par_by_hole[18],
yardage_by_hole[18] — display-only except par_by_hole, which feeds the mercy cap) · `duos` (round, team, player_1, player_2, match_slot 1-4, is_forced,
declared_by_captain_id — round-scoped, not season-scoped, since duos aren't fixed across the
weekend; no separate `matches` table, a match is two duos sharing a round + slot) ·
`hole_scores` (duo, round, hole, strokes — raw and uncapped, the double-bogey mercy cap is
engine-applied at computation time and never stored; tee_shot_used_player_id — the Drives Used
tap) · `reverse_mulligans` (duo, round, hole, called_at — one score in, one score out, no
divergent-score capture) · `challenge_bets` (proposer, acceptor, terms, stake, status, winner)
· `schedule_items`.

**Retired in Brief 31, v1.0 → v2.0** (see `supabase/README.md` for the full why-per-table):
`duo_submissions` (blind-reveal draft, superseded by the live declare-and-counter `duos`
model), `skins_entries` (skins retired — Challenge Ledger is the sole money mechanism now),
the old `matches` table (`team_a_id`/`team_b_id`/`slot` shape, superseded by `duos`),
`rounds.format` (one format now), `rounds.skins_buy_in` (fed a now-gone skins payout).

Realtime: clients subscribe to the event tables (now including `duos`, for the live Pairings
Night board); every mutation pushes to all phones (~1s).

## 6. Repo & environment

- Single repo on Chris's **personal MacBook**; Claude Code performs all changes via numbered briefs. `/docs` mirrors project-knowledge docs. Engine isolated under `/engine` with its test suite.
- Environments: local dev → Vercel preview (per-branch) → production URL (the link the guys get).

## 7. Ops — backups, uptime, keep-alive (no agents required)

- **Keep-alive:** a daily Vercel cron route runs a trivial DB query so the free Supabase project never idle-pauses.
- **Backups:** a scheduled GitHub Actions workflow (free) runs a nightly `pg_dump` against Supabase and stores the encrypted dump in a private backups repo. The free tier has no automated backups of its own, so this is not optional. Run one restore drill before Freeze.
- **Uptime:** a free external monitor (e.g., UptimeRobot) pings the production URL and alerts by email — most valuable during trip week.
- **Roster indexes:** collected by Chris the week of the trip and entered manually in admin — sixteen values, minutes of work.

**Brief 32 (`0026`/`0027`) — delete safety.** `hole_scores` and `reverse_mulligans` (by `duo_id` and
`round_id`), `duos` (by `team_id` and `round_id`) and `rounds.course_id` are `ON DELETE RESTRICT`: nothing
that has scores can be deleted by accident, and the database enforces it, not just the app. Admin delete
actions catch the FK violation (SQLSTATE 23503) and show a plain message. All trip timestamps are stored
UTC and rendered in `America/Phoenix` (see `lib/timezone.ts`).

**Brief 33 — scoring, formats, QA sandbox.**
- **Format per round:** `rounds.format` (`scramble` default | `best_ball`), admin-switchable, **locked by trigger** once any score exists for the round. Scramble writes `hole_scores` (one raw score per duo per hole, plus the optional Drives Used player); best ball writes `player_hole_scores` (one raw row per player per hole; a picked-up player has no row). Trigger-enforced: a score's `round_id` must be its duo's round, scramble rounds accept only `hole_scores`, best-ball rounds only `player_hole_scores`, a best-ball player must be in the duo, a Drives Used player must be in the duo.
- **One engine:** `buildMatchHoles()` (best ball: lowest RAW score per duo; scramble: pass-through) feeds the single `computeMatchState` / `resolveHoleResults`. The mercy cap stays in the engine; `min(cap(a), cap(b)) = cap(min(a, b))`, proven by test.
- **Write permission (RLS, not app code):** `can_score_duo(duo_id)` (`SECURITY DEFINER`, fixed `search_path`) is true when the device's linked player (`player_devices` via `auth.uid()`) is in either duo sharing that duo's round + slot. INSERT/UPDATE on `hole_scores`, `player_hole_scores` and INSERT on `reverse_mulligans` require it (UPDATE has USING and WITH CHECK). **DELETE has no policy** (service role only = commissioner undo / Corrections). `duos` writes are service-role only. `authenticated` SELECT policies exist on all four tables (a signed-in device uses the `authenticated` role; v2 tables originally had `anon` reads only, so signed-in devices read zero rows — the Brief 6 / 0015 bug, fixed in 0029). A picked-up best-ball score is cleared by a server action that re-checks `can_score_duo` under the caller's own session before deleting with the service role.
- **"Updated by":** `updated_by_player_id` / `updated_at` on both scores tables, set by trigger from the device link (never the client); service-role writes record no player = "the commissioner".
- **QA sandbox:** `players.is_test` / `seasons.is_test`; one QA season (year 1900, "QA Sandbox") with its own North/South teams and four QA players. Isolation is enforced in the data queries: `lib/scope.ts` `applyScope()` adds `is_test = false/true`, and `lib/season.ts` is the ONLY definition of "current season" (newest non-test) and the only roster read. Admin passcode-gated actions: Seed/reset (wipes `player_hole_scores → hole_scores → reverse_mulligans → duos → rounds` for the QA season only; `assertQaSeason()` refuses any season where `is_test = false`), Open as QA player (service-role replacement of this device's `player_devices` link; only `is_test` players; a device never holds a QA and a real link at once), Exit QA (removes a QA link only), Autofill from the pinned fixture for the round's format. Fixtures live in `engine/src/fixtures/qaFixtures.ts` (O'odham Gold's real pars) and are shared by the tests and Autofill.

