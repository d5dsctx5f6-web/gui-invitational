# Brief 32 — Courses, Rounds + Admin Seeding (v2) · Session Addendum

**Date:** October 6, 2026
**Status:** code complete; **migrations 0026 and 0027 run by Chris in the Supabase SQL editor and verified** (outputs below). Phone verification (Verification #4) is Chris's next step.

## Part 0 findings (reported before any code; Chris's decisions in brackets)
- Repo lives at `~/Desktop/Hedges Invitational /gui-invitational` (`.claude/launch.json` pointed at a stale path — fixed).
- Tee times lived on `matches.tee_time` (0023) and were dropped with `matches` in 0025. Day identity was `rounds.date` only. [Added `round_number`, unique per season.]
- `hole_scores → duos` was `ON DELETE CASCADE`; `courses → rounds → duos → hole_scores` cascaded all the way down. [Changed to RESTRICT, 0026.]
- `/admin` type-checked clean but was runtime-broken for Rounds, Corrections, Reverse mulligans, Skins and Duo submissions (untyped Supabase queries against dropped tables/columns).
- **Pre-migration snapshot (confirmed by Chris):** `rounds` had exactly two rows — `2026-07-27` (`87da78cd-2c0a-4e8d-96c0-5b5f67ccda95`) and `2026-08-05` (`ed2eede3-303c-4a4c-b014-d3e3fa61a3d7`), both in season `540782b2-012c-4524-a4fb-da22795c223a`, matching `archive/pre-v2-test-round/stale_rounds_export_brief32.json`. The 2027-01-01 "GreyHawk" round no longer exists (the Brief 15 addendum describes an earlier state).
- The build session could not read the live DB, so the stale-round delete was **guarded inside 0026** (only unreferenced pre-2027-03 rounds).

## Migration results (run by Chris)
- **0026:** no errors; all 7 FKs (`rounds_course_id`, `duos_round_id`, `duos_team_id`, `hole_scores_duo_id`/`_round_id`, `reverse_mulligans_duo_id`/`_round_id`) report `confdeltype = r`.
- **0027:** no errors; Chris confirmed all three verification queries matched: exactly 2 rounds (Round 1 O'odham/Gold `2027-03-27 18:00 UTC`; Round 2 Saguaro/Purple `2027-03-28 18:40 UTC`; both interval 10, note "Pending confirmation."), 3 active tee sets (Gold 70 / 69.9 / 119 / 6,510; Purple 71 / 70.2 / 132 / 6,603; White 71 / 68.8 / 125 / 6,252), 2 teams, 1 Silverado item, 2 active courses.
- Caveat: the `select … from rounds` check after 0026 and the first 0027 grid were reported as matching; the NOTICE lines for the two deleted rounds were not displayed by the editor, so deletion is evidenced by the 0027 grid showing exactly 2 rounds.

## Shipped
- **Migrations:** `0026_rounds_schema_and_fk_restrict.sql`, `0027_seed_trip_courses_rounds.sql` (idempotent; seed asserts 18 holes, par sums 70/71, yardage sums 6,510/6,603/6,252, SI permutation — the migration rolls back if any fails).
- **Engine (pure, no framework/Supabase imports):** `courseData.ts` (tee validation, Max per hole), `teeTimes.ts` (`groupTeeTimeIso`), `duoValidation.ts` (`validateDuo`, `deriveMatches`, `isShortHanded`), `fixtures/courses.ts`. **86 tests** (60 + 26): fixtures + assertions, Max spot checks (O'odham 2 → 7, Saguaro 9 → 5), Purple/White match-state invariance, UTC storage (`2027-03-27T18:00:00Z`) and rendering under four other process timezones, every duo rule.
- **Admin:** Rounds (course, active tee with Purple↔White switch, first tee / interval / note, derived group times in Arizona time, pending-confirmation badge), Teams (captain + roster only; create/rename/delete removed), Duos & matches (per round, per team; derived match view; short-handed badge; edit/delete; delete locked when scores exist), Courses & tees (per-hole par/yds/SI/Max table, par-edit warning, `is_active` filter). Every delete catches FK error 23503 with a plain message; delete-confirmation counts rewritten for duos/hole scores.
- **Docs:** paper-scorecard rule in RULEBOOK_V2 §8 and PRODUCT_SPEC_V2 §2; BUILD_PLAN rewritten to the 32–37 order (field test, two-device live gate, February rehearsal, Mar 1 freeze kept); PROJECT_STATUS (7-player rule marked resolved); ARCHITECTURE §5 reconciled; supabase/README updated.

## Deviations / judgment calls
1. **Admin styling:** kept the existing admin CSS Module classes rather than importing the Brief 30 tokens. `hedges-tokens.css` is deliberately isolated to `/design-preview`; pulling it into `/admin` would restyle the whole page and risk the route-isolation guarantee. Needs a decision before the Brief 33 visual pass.
2. `round_number` is nullable (CHECK 1–2 when set) so a stale-but-referenced round can't make the migration fail; seeded rounds always have it.
3. Dead action code (`correctHoleScore`, `removeReverseMulligan`, `setDuoSubmission`, skins actions) was left in `actions.ts`, unreachable from the UI, per "leave broken for now".
4. 0027 inserts rounds/teams/schedule item only if missing (never reverts admin edits); tee data is upserted (re-running restores the published scorecard values).
5. Champions wall section left as-is (still shows the retired Low Man / Skins King selects).

## Open issues
- Verification #4 on Chris's phone (checklist delivered in chat), then the cleanup-check SQL.
- **Routes failing `next build` (compile errors, Brief 33–34 scope):** `app/score/page.tsx`, `app/score/Scorecard.tsx`, `app/leaderboard/LeaderboardScreen.tsx`, `app/money/MoneyScreen.tsx`.
- **Runtime check of the other routes (dev server, against the live v2 DB):**
  - `/money` — **500**: `MoneyScreen.tsx` imports `computeSkins`/`skinsPayouts`/`SkinsHoleScore` (deleted engine exports); its page loader also reads the dropped `matches`, `duo_submissions`, `skins_entries`, `rounds.skins_buy_in` and `hole_scores.player_id`. Brief 36 / ledger rebuild.
  - `/schedule` — **200, but silently incomplete**: shows `schedule_items` (including the new Silverado item), but the Saturday/Sunday "Tee times" cards are missing because its loader reads `rounds.format` and the dropped `matches` (`tee_time`); the errors are swallowed. Needs a rebuild onto `rounds.first_tee_time` + derived group times (not in Brief 32's list; suggest folding into Brief 34).
  - `/duos` — **200 only as the sign-in gate**; once signed in it reads `rounds.format`, the dropped `matches` and `duo_submissions`, and `DuosScreen` upserts `duo_submissions`, so it would be broken. Not exercised past the gate (standing rule: no signing in as real players). Replaced by Brief 35's Pairings Night board.
  - `/champions` — **200, works**, but still shows the retired Low Man / Skins King labels (reads the orphaned `seasons.individual_champion_player_id` / `skins_king_player_id` columns, which still exist).
  - `/admin` — **200**, loads to the passcode gate; the logged-in view was not exercised from the build session — Chris's phone check covers it.
- Tee-time confirmations pending: Saturday 11:00 (Talking Stick), Sunday 11:40 vs 12:40 (WeKoPa).
