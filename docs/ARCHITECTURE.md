# GUI INVITATIONAL — ARCHITECTURE

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

## 5. Data model sketch (tables; refine in Brief 2)

`seasons` · `players` (name, ghin_or_trip_index) · `teams` / `team_members` · `rounds` (date, format, course_id, tee) · `courses` (rating, slope, par, stroke_index[18] per tee) · `matches` (round, team_a/b, slot A/B) · `duo_submissions` (captain, round, duos, committed_at) · `hole_scores` (player, round, hole, strokes, do_over_flags) · `reverse_mulligans` (team, round, hole, victim, original_holed_score) · `skins_entries` (player, round) · `challenge_bets` (proposer, acceptor, terms, stake, status, winner) · `schedule_items`.

Realtime: clients subscribe to the event tables; every mutation pushes to all phones (~1s).

## 6. Repo & environment

- Single repo on Chris's **personal MacBook**; Claude Code performs all changes via numbered briefs. `/docs` mirrors project-knowledge docs. Engine isolated under `/engine` with its test suite.
- Environments: local dev → Vercel preview (per-branch) → production URL (the link the guys get).

## 7. Ops — backups, uptime, keep-alive (no agents required)

- **Keep-alive:** a daily Vercel cron route runs a trivial DB query so the free Supabase project never idle-pauses.
- **Backups:** a scheduled GitHub Actions workflow (free) runs a nightly `pg_dump` against Supabase and stores the encrypted dump in a private backups repo. The free tier has no automated backups of its own, so this is not optional. Run one restore drill before Freeze.
- **Uptime:** a free external monitor (e.g., UptimeRobot) pings the production URL and alerts by email — most valuable during trip week.
- **Roster indexes:** collected by Chris the week of the trip and entered manually in admin — sixteen values, minutes of work.
