# BRIEF 31 — SCHEMA + ENGINE MIGRATION (v1.0 → v2.0 FORMAT)

**Project:** The Hedges Invitational app · **Milestone:** first of five v2.0 migration briefs · **Issued:** Aug 29, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 30 closed and verified (design tokens, CSS Modules confirmed as styling approach — irrelevant to this brief's scope, but confirms the foundation this sits on is solid); `PRODUCT_SPEC_V2.md` and `GUI_INVITATIONAL_RULEBOOK_V2.md` (canonical — supersede all v1.0 spec/rulebook content)
**Gate:** migrations apply cleanly to Supabase; the engine's rebuilt test suite is green with zero framework/Supabase imports (the isolation rule holds); a hand-constructed fixture proves a full duo-vs-duo scramble match computes correct F9/B9/18 state, the double-bogey cap applies correctly, a reverse mulligan resolves with a single score, and North/South standings tally correctly across a simulated round. Not a phone-visible demo — this is backend. The visible payoff lands in Briefs 32–33.

---

## Context (read once)

This is the largest brief in the redesign. v1.0's engine and schema were built around four teams, two duos per team, shamble Saturday / four-ball Sunday, net scoring with real handicap strokes, gross skins, an individual net race, earned Sunday pairings, and a reverse-mulligan two-score rule. **Almost none of that survives.** PRODUCT_SPEC_V2 §2 is the canonical target — read it before writing any code, not just this brief.

**Why so much is being deleted, not adapted:** the old complexity existed to serve mechanisms that no longer exist. Net scoring fed match play and skins — skins is gone and match play no longer uses strokes. The individual race needed per-player scores — a scramble has one score per duo. Earned Sunday pairings derived from standings — Sunday's pairings now come from a live declare-and-counter draft, not a formula. Pulling these out isn't a simplification pass on top of the old engine; it's building the new one and discarding what no longer has a job.

**What survives largely intact:** the store-raw-derive-everything principle (ARCHITECTURE §3), the count-agnostic discipline (Brief 2's founding rule — still matters, see the open question below), the realtime architecture (Brief 7), the F9/B9/18 segment-scoring shape (front/back/overall, 1pt/½pt each — the *comparison* changes, not the point structure), and course handicap conversion as a **display-only** utility (captain intel on the Pairings Night board — no longer feeds scoring anywhere).

---

## Open question — needs your decision, not an engineering guess

**v2.0's rules don't yet cover what happens if a team shows up with 7 players instead of 8.** The declare-and-counter pairings mechanic (three cycles + one forced match) assumes exactly 8v8. Take a player short and the math doesn't cleanly resolve — someone plays two matches, a match goes 1-vs-2, or something else entirely. This was never specified in this session's rulebook rewrite, and it's a real trip-week risk (someone gets sick, a flight's delayed) — the same category of problem the count-agnostic principle was built to survive in v1.0.

**This brief will build the schema to not preclude a fix later** (no constraint forcing exactly 8 players per team, nullable where sensible) but will **not invent a resolution rule** — that's a Rulebook decision, not an engineering one. Flag your answer whenever you land on it; it doesn't block this brief, but it does block Brief 32 actually handling the scenario gracefully on the Pairings Night board.

---

## Scope — Part A: Schema migration

**Drop entirely** (confirm pre-season/demo-only data before dropping — see the verification note below, do not assume):
- `duo_submissions` — replaced by `duos` (below); the blind-simultaneous-reveal model it powered is gone, Pairings Night is sequential and open.
- `skins_entries` — skins is retired.
- The old `matches` table's `team_a_id`/`team_b_id`/`slot` shape — a "match" is now just two duos sharing a round and a slot; storing that pairing a second time risks the two disagreeing. No separate `matches` table — derive it from `duos`.
- `rounds.format` enum (`shamble`/`four_ball`) — one format now. **This also retires the trick Brief 17 built where format determined which day it was** (shamble=Saturday, four_ball=Sunday, used for tee-time slotting). Day identity now comes from `rounds.date` / a round-order column directly — confirm nothing else silently depended on reading `format` for day identity before dropping the column.

**Modify:**
- `teams` / `team_members`: two teams per season, not four — **North Hedges** and **South Hedges**, fixed names (not admin-editable text — these are structural). Eight players per team_members row-set, not four. No CHECK forcing exactly 8 (see the open question above).
- `hole_scores`: change from player-scoped to **duo-scoped**. New shape: `duo_id` (FK to `duos`), `round_id`, `hole` (1–18), `strokes int` (raw, uncapped — mercy cap is engine-applied, not stored), `tee_shot_used_player_id` (nullable FK to `players` — the Drives Used tap). **Drop** `breakfast_ball`, `mulligan`, `match_strokes` — do-overs are retired and the two-score rule is retired, a scramble hole has exactly one number.
- `reverse_mulligans`: rescope the unique constraint from `(team_id, round_id)` to `(duo_id, round_id)` — one per duo per round, not one per team. **Drop** `victim_player_id` and `original_holed_score` — there's no divergent score to capture anymore; the replay result simply is the score. Keep `hole` (which hole it was called on) and `called_at`.

**New:**
- `duos` table: `id`, `round_id`, `team_id`, `player_1_id`, `player_2_id`, `match_slot int` (1–4), `is_forced bool default false` (true for the auto-filled fourth match), `declared_by_captain_id` (nullable — audit/history value for the Pairings Night screen later, not load-bearing for the engine). **Round-scoped, not season-scoped** — per RULEBOOK_V2, duos aren't fixed across the weekend, a captain can run back Friday's pairs or reshuffle entirely for Sunday.
- `seasons` gains: `coin_flip_winner_team_id` (nullable FK to `teams`), `coin_flip_choice` (nullable enum `declare`/`counter`) — the single raw fact Friday's Pairings Night order derives from; Sunday's order is computed by reversing it, never independently stored (store-raw-derive-everything, applied to the coin flip itself). Also `chip_off_winner_team_id` (nullable FK to `teams`) — for the rare 12–12 tie; a real-world event to record, not something to derive.

**RLS for `duos`:** interim admin/service-role-only writes for this brief, anon-select for realtime reads — same pattern Brief 2 used for `hole_scores` before Brief 6 formalized identity-scoped writes. The actual captain-facing write flow is Brief 32's job once the Pairings Night actor model is designed; this brief just needs the schema provably correct, not the final write policy.

Commit the schema. Update `/supabase/README.md`'s table-to-spec-section map to match.

---

## Scope — Part B: Engine changes (`/engine`, pure TypeScript — isolation rule still holds, no framework/Supabase imports)

**Delete:**
- `computeSkins()` and all skins carryover logic.
- Individual net race rollup.
- Earned Sunday pairings computation.
- The reverse-mulligan two-score split logic.
- Format allowance percentage config/hook.
- The "best net ball among available players" per-hole comparison — a scramble hole has one stored number per duo; there's nothing to compare within a duo anymore.

**Simplify:**
- **Duo match state (F9/B9/18):** same segment shape as before (front 9 / back 9 / overall 18, win=1pt/halve=½pt, early-close detection) but the per-hole comparison is now `min(duoA.strokes, par + 2)` vs `min(duoB.strokes, par + 2)` directly — the mercy cap applied at comparison time, never stored. Much simpler function than what it replaces.
- **Team standings:** North Hedges vs South Hedges, two-way points tally, not four-way. No head-to-head tiebreaker needed — with two teams, their record against each other *is* the whole tournament. Tiebreak ladder collapses to: points → total holes won → flag for chip-off (do not auto-resolve; chip-off is a real-world event, `seasons.chip_off_winner_team_id` gets set by admin after the fact).
- **Reverse mulligan status:** simplifies to "has this duo used their one-per-round RM yet" — a count check against `reverse_mulligans` filtered by `duo_id` + `round_id`. No original/match score distinction to carry.

**Keep, repurposed:**
- `courseHandicap()` conversion — keep the function, but it now feeds **display only** (captain intel on the future Pairings Night board), never any scoring computation. Make this boundary explicit in code — a comment or module split, not just convention — so nobody wires it back into match state by accident in a later brief.

**New:**
- **Mercy cap utility:** `cappedStrokes(strokes, par) = Math.min(strokes, par + 2)`. Pure, trivial, but every match-state computation must route through it rather than reading raw `strokes` directly.
- **Drives Used rollup:** count of `tee_shot_used_player_id` occurrences per player across a round/season. Purely informational, feeds nothing competitive.
- **Pairings order derivation:** given `seasons.coin_flip_winner_team_id` + `coin_flip_choice`, derive Friday's declare/counter sequence for all three cycles, and Sunday's as the reverse. Pure function of the one stored fact — this is the payoff of storing the coin flip raw instead of storing each day's order independently.
- **Count-agnostic handling, adapted:** a missing `hole_scores` row for a duo/hole is an absence or not-yet-entered, never a crash or a zero. Preserve this discipline exactly as Brief 2 established it — it matters more now, not less, given the open question above.

---

## Scope — Part C: Test suite rebuild

The existing suite (84 tests per Brief 7) covers substantial logic that no longer exists. **Remove** tests for: skins (all variants — opt-in, non-entrant invisibility, carryover), the two-score RM rule, individual race, earned pairings, format allowances, the best-net-ball comparison.

**Keep/adapt:** course handicap conversion (still correct, now display-only — same test, different docstring noting it), count-agnostic absence handling (adapt fixtures to duo-scoped scores), shortened-event resolution (same concept, simpler with two teams).

**New tests, minimum coverage:**
- A hand-constructed 18-hole duo-vs-duo scramble match → correct F9/B9/18 results, including a segment that closes early.
- Mercy cap: a duo score above par+2 is capped for match purposes; confirm the raw stored value is untouched (store-raw-derive-everything, proven, not just asserted).
- Reverse mulligan: called, replay score recorded, no divergent-score branch exists to test against (a good sign this simplified correctly — one score in, one score out).
- Two-team standings: points tally correctly across a simulated round; a 12–12 scenario correctly flags for chip-off rather than attempting to auto-resolve.
- Pairings order derivation: given a coin-flip fact, Friday's three-cycle declare/counter order is correct, and Sunday's is provably the reverse of Friday's — not independently computed, actually derived from the same stored fact.
- Drives Used tally: correct count per player from raw `tee_shot_used_player_id` data.
- Count-agnostic: a duo missing a hole score doesn't crash match-state computation.

Green suite = brief complete.

---

## Verification

1. **Before dropping/altering any table with existing rows**, confirm what's actually in the database — report row counts on `duo_submissions`, `skins_entries`, `hole_scores`, `reverse_mulligans`. If it's demo/seed data only (expected, given no real trip has happened and Brief 7's addendum notes no real player ever completed sign-in), proceed. If anything looks like real captured data, stop and ask before proceeding — don't assume.
2. All migrations apply cleanly; RLS present on new/changed tables.
3. `npx vitest` green, including every new test category above.
4. Zero framework or Supabase imports in `/engine` (isolation rule, unchanged since Brief 2).
5. Confirm `courseHandicap()` has no remaining call sites inside match-state computation — grep for it, report every call site found.
6. Report the exact diff: what was dropped, what was kept, what's new — this brief's session addendum should read as a clean accounting, not a summary.

## Close-out

Session addendum to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md`. **Reconcile `ARCHITECTURE.md` §5** to the schema actually built here (same discipline as every prior brief — the doc should never drift from what's real).

## Next

Brief 32 — the Pairings Night board: the live declare-and-counter UI, built against this brief's `duos` schema and Brief 30's design system together. First screen where the visual reset and the format migration actually meet.
