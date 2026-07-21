# BRIEF 2 — DATA MODEL + ENGINE CORE

**Project:** The GUI Invitational app · **Milestone:** toward M1 · **Issued:** Jul 20, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** M0 complete (Supabase project live, `players` table seeded, engine module stubbed with Vitest).
**Gate:** not a demo milestone by itself — this lays the schema and the match-play engine core that M1's playable scorecard sits on. Success = migrations applied, engine core computing net match state, first real test suite green.

---

## Context (read once)

M0 shipped the rails: a live PWA reading a `players` table from Supabase. Brief 2 builds the **skeleton of the game** — the full database shape, plus the first real slice of the scoring engine.

**Scope discipline — read carefully.** This brief builds the **match-play core only**, not the full engine. The full engine (skins, reverse mulligan two-score rule, individual-race rollup, shortened-event resolution, format allowances) is the **M2 gate** and comes in Brief 3, layered onto the foundation this brief validates. Building the core first gets a playable scorecard into Chris's hands fast and proves the architecture on the simplest path before the hard edges go on. **Do not build deferred items** (listed at the bottom) — stub their tables so the schema is right once, but write none of their logic.

Grounding docs are in the repo's `/docs` and Chris's Desktop project folder: `PRODUCT_SPEC.md` (canonical — §2 is the competition spec the engine implements), `ARCHITECTURE.md` (the store-raw-derive-everything principle and the data-model sketch in §5), `TESTING_AND_HARDENING.md` (what the engine suite must eventually cover). The engine implements PRODUCT_SPEC §2 exactly.

---

## Design principle that governs this brief: **count-agnostic**

The competition is designed for 16 players / 4 teams / two duos each — but **the schema and engine must never hardcode that count.** If only 14 or 15 players show up on trip day (cancelled flights happen), the app cannot break. This is mostly free if built right from the start, and expensive to retrofit later. Concretely:

- The engine derives match state from **the scores that actually exist**, never from an expected roster size. A duo missing a player is just a duo whose best-net-ball comes from one available ball that hole — the math still resolves.
- "Who is playing this round / in this match" is **data** (match assignments + which players have scores), never a constant baked into logic.
- A missing hole score must never crash the engine or corrupt match state — it's an absence or a not-yet-entered hole, handled gracefully.
- **Do not build the absence admin UI in this brief** — that ships with the admin panel in M3. The job here is only to ensure nothing in the schema or engine *prevents* a player being marked absent and everything still computing. Build the bones count-agnostic; the UI comes later.

(Note for Chris, not code: the *rule* for how a short-handed duo match resolves — 1-v-2, segment forfeit, or someone plays two balls — is a Rulebook decision to settle before March. The engine will execute whatever is chosen; it just needs to not assume full duos.)

---

## Scope — Part A: Data model (migrations)

Build the full schema now so the database shape is settled once. One migration file per logical group under `/supabase/migrations/`, committed to the repo, applied to Supabase. Enable RLS on every table with an anon-SELECT policy for now (writes arrive with the auth model in a later brief; admin writes currently go through the Supabase dashboard/service role).

Tables (refine column details against ARCHITECTURE §5; these are the required shapes):

- **`seasons`** — `id`, `year`, `name`. Seed Year 1 (2027). Every other table that needs a season FKs here — the champions wall and annual-franchise design depend on this existing from day one.
- **`players`** — already exists; add `season`-independence is fine (players persist across years). Confirm `index numeric null` present.
- **`courses`** — `id`, `name`, and per-tee setup: `rating numeric`, `slope int`, `par int`, `stroke_index int[18]` (the hole-by-hole handicap-allocation order). Support multiple tee sets per course (either a `tees` child table or a JSON column — your call, but per-player mixed tees must be representable).
- **`rounds`** — `id`, `season`, `date`, `format` (enum: `shamble` | `four_ball`), `course_id`, `default_tee`. Two competitive rounds; the Friday fun round is **not** a row here (engine never touches it).
- **`teams`** — `id`, `season`, `name`, `captain_player_id`. Four per season.
- **`team_members`** — `team_id`, `player_id`. (Count-agnostic: a team may end up with 3 if someone's absent — schema must allow it, no CHECK forcing exactly 4.)
- **`matches`** — `id`, `round_id`, `team_a_id`, `team_b_id`, `slot` (A or B — which duo pairing). Represents one duo-vs-duo match. References actual assigned players via a duo linkage (below).
- **`duo_submissions`** — `id`, `round_id`, `team_id`, `captain_player_id`, the two players in Duo A, the two in Duo B, `committed_at` (null until committed — powers the blind reveal later). This is where "who plays in which match" actually resolves.
- **`hole_scores`** — `id`, `player_id`, `round_id`, `hole` (1–18), `strokes int`, `breakfast_ball bool`, `mulligan bool`. **Include `match_strokes int null`** — the separate match-only score for the reverse-mulligan two-score rule (null unless an RM diverges it). Skins/individual read `strokes`; match engine reads `coalesce(match_strokes, strokes)`. Building this column now avoids a painful migration in Brief 3.
- **Stub tables (create, RLS, but no logic this brief):** `reverse_mulligans` (`team_id`, `round_id`, `hole`, `victim_player_id`, `original_holed_score`), `skins_entries` (`player_id`, `round_id`), `challenge_bets` (`proposer_id`, `acceptor_id`, `terms text`, `stake numeric`, `status`, `winner_player_id`), `schedule_items`.

Commit the schema. Add a short `/docs` note or `/supabase/README.md` mapping each table to its PRODUCT_SPEC section.

---

## Scope — Part B: Engine core (pure TypeScript, `/engine`)

The engine stays a pure module: `(events, courseSetups, config) → derived state`. No I/O, no framework imports, no Supabase client inside `/engine`. This brief implements exactly three things:

1. **Course handicap conversion.** `courseHandicap(index, {slope, rating, par}) = round(index × (slope / 113) + (rating − par))`. Then allocate strokes across holes by stroke index (lowest SI gets the first stroke; wrap for handicaps > 18). Output: for a given player + course + tee, how many strokes fall on each hole. Format allowances are a **deferred** input — for now assume 100% (full handicap); leave a clearly-marked hook where the allowance % will multiply in. Players never do this math; the engine does.

2. **Net score per hole.** `net = gross − strokesReceivedOnThatHole`, using the match score source `coalesce(match_strokes, strokes)` for match computations. Count-agnostic: if a player has no score for a hole, that ball simply doesn't contribute — no crash, no default-zero corruption.

3. **Duo match state — F9 / B9 / 18.** For a duo-vs-duo match, per hole the duo's ball = **best net ball among that duo's available players** (shamble and four-ball both resolve to best-net-ball for scoring purposes at the hole level — the tee-shot mechanics differ on the course but the per-hole scoring input to the engine is the same). Compare the two duos hole by hole → hole won/halved/lost. Then derive three independent segment results: front 9 (holes 1–9), back 9 (holes 10–18), overall 18 — each worth 1 point, halve ½. A segment can be decided early (e.g., 6up with 4 to play) — reflect "closed" vs "in progress." Output a clean match-state object the UI can render: per-segment status, holes up/down, thru-count, and points earned so far.

**Do not** compute team standings rollup, skins, RM logic, individual race, or shortened-event in this brief — those are Brief 3. Just the single-match core above.

---

## Scope — Part C: The first real test suite (Vitest, gates this brief)

Replace the placeholder test with real coverage of Parts B.1–B.3. At minimum:

- Handicap conversion: a known index/slope/rating/par → expected course handicap (hand-check 2–3 cases); correct stroke allocation including a >18 handicap that wraps.
- Net scoring: gross minus dots on the right holes; a hole with a missing score contributes nothing rather than zero.
- Match state: a hand-constructed 18-hole duo match → correct F9/B9/18 results; a segment that closes early; an all-square segment halved.
- **Count-agnostic cases (this brief's signature tests):** a duo playing a hole with only one available ball resolves correctly; a match where one duo is a player short across the round still produces valid segment results and never throws.

Green suite = brief complete. These tests become the seed of the M2 full-trip suite.

---

## Verification

1. All migrations apply cleanly to Supabase; every table present with RLS; Year 1 season and the two competitive rounds seedable.
2. `npm run dev` still builds; the M0 roster page still works (no regression).
3. Engine core computes correct match state on the test fixtures; `npx vitest` green, including the count-agnostic cases.
4. Nothing in `/engine` imports framework or Supabase code (the isolation rule holds).

## Deferred to Brief 3 (do NOT build here)

Skins (gross, opt-in, non-entrant invisibility, carryover chains) · reverse mulligan two-score logic · individual net race rollup · team standings + earned Sunday pairings · shortened-event resolution · format allowance percentages · the absence admin UI. Their tables are stubbed by this brief; their logic is not.

## Close-out

Write a session addendum (shipped / commits / deviations / open issues), save to the Desktop project folder and `/docs`, for Chris to upload to project knowledge. Note any schema decisions that deviated from ARCHITECTURE §5 so the doc can be reconciled.
