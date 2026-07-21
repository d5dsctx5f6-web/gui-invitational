# Brief 2 — Data Model + Engine Core · Session Addendum

**Date:** July 20, 2026

**Shipped:** Full database schema — 7 new migration files (0002–0008) creating `seasons`, `courses`, `course_tees`, `rounds`, `teams`, `team_members`, `matches`, `duo_submissions`, `hole_scores`, and the four stub tables (`reverse_mulligans`, `skins_entries`, `challenge_bets`, `schedule_items`). All applied to Supabase, RLS + anon-select on every table, Year One (2027) season seeded. Engine core in `/engine`: course handicap conversion, net-per-hole scoring, and duo match state (F9/B9/18) as pure functions. 18 passing Vitest tests including the count-agnostic signature cases. `/supabase/README.md` maps tables to spec sections. Build, lint, and framework-isolation rule all clean.

**Commits:** through `07a501c`.

## Deviations from ARCHITECTURE §5 (reconcile the doc to match)

- Course setup split into a `course_tees` child table rather than columns on `courses` directly — enables multiple tee sets per course and per-player mixed tees. Improvement over the sketch.
- "Who plays which match" resolves through `duo_submissions` (with nullable second duo players for count-agnostic short-handed duos) rather than a duo linkage on `matches` itself.
- `hole_scores.match_strokes` (nullable) built now though its reverse-mulligan logic is deferred to Brief 3 — avoids a later migration.

## Deferred to Brief 3 (tables stubbed, logic not built)

Skins, reverse mulligan two-score logic, individual net race rollup, team standings + earned Sunday pairings, shortened-event resolution, format allowances, the absence admin UI.

## Open items

None blocking. Courses/tees/roster indexes/buy-in still pending per SPEC §6. ARCHITECTURE §5 to be updated to match the schema decisions above.

## Next

Brief 3 — full scoring engine (the M2 gate): skins, reverse mulligan two-score rule, individual race, standings + earned pairings, shortened event, allowances — layered onto this core, with the simulated-full-trip test suite.
