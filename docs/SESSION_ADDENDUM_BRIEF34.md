# Brief 34 — Cup Leaderboard, Match Detail, TV Board, QA Scenarios + Pressure-Test Protocol · Session Addendum

**Date:** October 6, 2026
**Status:** code complete; migrations 0033 and 0034 run and verified by Chris; **Part F (the adversarial pressure test) passed in full** on the live database (QA scope only). Pending: deploy, the production no-passcode checks, and Chris's short phone + TV look-and-feel check.

## Part 0 decisions (Chris confirmed a–i)
a. Round complete = every match has all three segments decided (early close counts); the v1 `isRoundComplete` was **replaced**, not kept. b. `seasons.event_shortened` + admin "Declare event shortened" with confirm and undo; the banner shows only when declared. c. "Pairings pending" and no "to win" line until every round has duos. d/e. 12½ of 24, 11 of 21; "win the Cup". f. Count all posted holes; rulebook §8 line added and a reminder note on the scorecard once a match's 18 is decided. g. Admin cookie widened site-wide (httpOnly / Secure in production / SameSite=Lax, read only by the admin check). h. `rounds` + `seasons` in the realtime publication, plus a 30 s refetch fallback on `/board`. i. Part F run against the local build + live DB with real RLS sessions, plus no-passcode checks on production after deploy.

## Shipped
- **Migrations:** `0033` (12 more QA players + roster → 16, 8 v 8) and `0034` (`seasons.event_shortened`, `rounds` + `seasons` in the realtime publication). Both tested against an in-memory replay of every migration first, then run and verified by Chris.
- **Engine (pure):** `cup.ts` (`cupStandings`, `projectedStandings`, `matchCardStatus`, `cupHeadline`, `canRecordChipOff`), `isMatchDecided` / v2 `isRoundComplete`, `fixtures/qaScenarios.ts` (six scenarios as hole-result scripts, results pinned by hand). Tests 128 → **166**.
- **App:** `/leaderboard` (Cup header, "X to win", progress line, "If it ended now", rounds, four match cards, edge-state messages), match detail (`/leaderboard/match/[round]/[slot]`, read-only, neutral perspective, cap marks, mulligans, Drives Used), `/board` (TV: landscape, no scroll at 1080p, no login, no admin links, dark default, LIVE clock, 30 s fallback), `/schedule` tee-time cards (rounds + duos, Arizona time, pending note), `lib/cupData.ts` (one loader), `lib/qaScope.ts` (QA only for the commissioner or a QA-signed-in device), admin **The Cup** (record / clear chip-off winner, declare / undo shortened), QA sandbox **full trip + Load scenario 1–6 + open as any of 16 QA players** (also `npx tsx scripts/qa-scenario.ts <1-6|reset> [scramble|best_ball]`).
- **Docs:** `PRESSURE_TEST_PROTOCOL.md` (standing), spec §2, ARCHITECTURE, BUILD_PLAN, rulebook §8.

## Part F report
**F1 mutation testing — 18/18 killed, every file restored byte-for-byte** (`scripts/pressure-test/mutate.ts`). The first run found **one survivor** — *tiebreak order (holes before points)* left all 160 tests green, because no test pinned a case where the points leader has fewer holes won. A search found real cases (e.g. South leads 5–4 on points while North won 25 holes to 14); they are now tests (and a mislabeled test was corrected), and the mutation is killed (2 failing tests). The brief's ten mutations plus eight extras are in the script.

**F2 live end-to-end (`scripts/pressure-test/live.ts`) — 70/70 on the final run:**
| Item | Result | Evidence |
|---|---|---|
| F2.1 six scenarios × both Round-2 formats | PASS | live rows (read signed-out through RLS) → engine equal the pinned result; rendered `/leaderboard` and `/board` show the pinned score and wording (12½ / 11 / 6½ to win, "of 21", chip-off, shortened, "If it ended now North 10½ – South 7½", match statuses) |
| F2.1 recorded chip-off winner | PASS | "South Hedges win the Cup (chip-off)" replaces the banner |
| F2.2 A1 write to another QA match | PASS (denied) | `new row violates row-level security policy for table "hole_scores"` |
| F2.2 A2 write to a 2027 duo | PASS (denied) | live: `can_score_duo(unknown)=false`, insert refused. A literal 2027 duo can't exist without writing to 2027 (forbidden, 2027 has 0 duos), so the rule was proven on a **synthetic 2027 season in the migration replay**: the QA player's score and mulligan inserts are both denied by RLS, `can_score_duo` is false for both duos, and a real player in that match can write (control) |
| F2.2 A3 signed-out device writes | PASS (denied) | RLS violation on `hole_scores` and `reverse_mulligans` |
| F2.2 A4 player deletes a score | PASS | 0 rows removed, both rows still stored (no DELETE policy) |
| F2.2 A5 second reverse mulligan, same duo + round | PASS (denied) | `23505 duplicate key … reverse_mulligans_duo_id_round_id_key`, also from the other duo's player |
| F2.2 A6 change a locked round's format | PASS | player update touched 0 rows; service role blocked: "Format is locked — scores have been posted for this round." |
| F2.2 extras | PASS | score moved outside the match denied; best-ball row into a scramble round rejected; players can't edit/create duos; players can't forge `event_shortened` / chip-off (0 rows) |
| F2.3 concurrency, 30 same-hole races (half in opposite row order) | PASS | 0 mixed pairs, 0 wrong row counts, 0 deadlocks; every outcome was one writer's complete pair; both clients read back exactly what was stored |
| F2.3 realtime to a third subscribed session, 20 posts | PASS | 20/20 delivered, **median ~550 ms, worst ~640 ms** |
| F2.4 isolation | PASS | 2027: 0 duos, 0 `hole_scores`, 0 `player_hole_scores`, 0 mulligans; 0 QA players on real teams; default `/leaderboard`, `/board`, `/schedule`, `/champions`, `/` show no QA data; `?scope=qa` with no session, a **forged** admin cookie, an **expired** one, and a direct QA match URL all show nothing |
| F2.5 QA reset | PASS | 2 rounds, 16 duos, 0 scores, 0 mulligans, flags cleared, QA device links removed |

The first F2 run was 66/70; all four failures were my page-text expectations (the leaderboard and the terser TV board word things differently), fixed by splitting expectations per page — not by weakening them.

## Findings and judgment calls
1. **Real Sunday round is set to best ball** in the database (found while checking the default `/leaderboard`). I did not make that change and left it alone; no scores exist so nothing is locked. Chris to confirm it is intentional.
2. A clinch was being claimed while Sunday's pairings were pending (Saturday's points measured against only 12 possible). Caught by a test, fixed: no target and no clinch while any round is unpaired (unless the event is declared shortened).
3. A layout bug (body is a centered flex column, so the new screens shrink-wrapped to their widest content on a phone) was fixed in the shared shell.
4. Dev server: Turbopack panics on `/admin` in this folder name; local verification used `next dev --webpack`.

## Open
- Production: deploy, run the no-passcode checks, then Chris's phone + TV check and the cleanup SQL.
- `/champions` Low Man / Skins King labels → Brief 36.
