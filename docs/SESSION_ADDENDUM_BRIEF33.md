# Brief 33 (Revision 2) — Scorecard: Scramble + Optional Best Ball, QA Sandbox, Green Build · Session Addendum

**Date:** October 6, 2026
**Status:** code complete; migrations 0028–0031 run and verified by Chris; verified end-to-end against live Supabase from local dev (QA data only). **Pending: deploy to production and Chris's two-device gate (tap-by-tap script delivered in chat).**

## Part 0 findings (accepted; built into the revision)
- Score writes had **no policies at all** after 0025 (the old ones went with the dropped tables), and the v2 tables' reads were `anon`-only, so any signed-in device (the `authenticated` role) read zero rows and got no realtime events — the Brief 6 / 0015 bug recurring.
- Realtime: the generic `useRealtimeRefetch` hook works unchanged on the duo tables; `duos`, `hole_scores`, `reverse_mulligans` were already in the publication.
- Engine surface sufficed for per-hole results and segment liveness; missing pieces were built (adapter, status labels, permission/format-lock/QA-safety/season-scope pure functions, fixtures).
- Uniqueness already existed: `hole_scores (duo_id, round_id, hole)` and `reverse_mulligans (duo_id, round_id)`.
- `seasons.year` is unique, there was no "current season" concept (pages used `limit(1)` / year-desc), so a QA season needed its own year (1900) and every season/roster read now goes through one scoped helper.

## Shipped
- **Migrations (printed one block at a time, outputs confirmed by Chris):** `0028` schema (format, is_test, updated-by columns, `player_hole_scores`, `current_player_id()`, `can_score_duo()`), `0029` RLS, `0030` triggers (audit, integrity, format lock), `0031` QA seed. `0032` (optional captain reset) was **not needed** — both 2027 captains were blank.
- **Engine (pure):** `scoring.ts`, `matchStatus.ts`, `scorePermissions.ts`, `formatLock.ts`, `qaSafety.ts`, `seasonScope.ts`, `fixtures/qaFixtures.ts`. **114 tests** (86 + 28).
- **App:** `/score` rebuilt (Brief 30 tokens via `app/_hedges`, shared with the placeholders); `lib/scope.ts` + `lib/season.ts` (current-season and roster helpers, all season/player reads routed through them); admin round format switch, **QA sandbox** (seed/reset, open/exit as QA player, autofill, QA format switch), **Corrections** rebuilt (round → match → hole, both formats, remove mulligan, delete hole/match scores, delete-duo guard); `/leaderboard`, `/money`, `/duos` placeholders; dead v1 screens deleted. **`next build` green.**
- **Docs:** RULEBOOK_V2 §1/§5/§6, PRODUCT_SPEC_V2 §2, ARCHITECTURE, BUILD_PLAN (best-ball print variant noted for Brief 37; FT2 reframed as the QA two-device gate), PROJECT_STATUS.

## Verification done locally against live Supabase (QA data only; 2027 untouched)
- Migrations replayed in an in-memory Postgres first: 31 behavior checks (RLS, triggers, lock, RESTRICT) all passed.
- Scramble fixture via Autofill → F9 ½ · B9 ✓ N · 18 ✓ N · North 2½ – South ½; South's mulligan on hole 11; Drives Used tallies equal the fixture's.
- Best-ball fixture via Autofill → F9 ✓ S · B9 ½ · 18 ✓ S · North ½ – South 2½; North's mulligan on hole 11.
- 9 on a par 4 → "counts as 6 (mercy cap)"; best ball 8/9 → "counts as 6".
- Failed post (fetch rejected): values stay, "Not saved — tap to retry", no advance; retry posts and advances.
- A second device (QA South 1, through RLS) edited hole 1 → the first device updated live with "Hole 1 updated by QA South 1" and the banner flipped to "Hole 1 halved".
- RLS: an unlinked device's insert denied; a player's delete is a no-op; the format lock blocks even the service role ("Format is locked — scores have been posted for this round.").
- Best ball: picked-up player posts; marking a previously scored player picked up clears his row through the server action (permission re-checked first).
- Corrections: edit recomputes the match; delete hole scores; remove mulligan; "This duo has scores — remove them in Corrections first."
- Exit QA returns the device to the signed-out gate; the sign-in roster shows only real players.

## Deviations / judgment calls
1. **Round format control for the QA round lives in the QA sandbox section**, because the Admin → Rounds section is (correctly) scoped to the 2027 season; the QA delete-duo button lives in QA Corrections for the same reason.
2. **Autofill and hand-entered holes:** the pinned result only holds if hand-entered holes match the fixture; the two-device script gives Chris the fixture values for holes 1–3.
3. The admin Rounds/Courses UI keeps the existing admin CSS (decision carried from Brief 32); `/score` and the placeholders use the Brief 30 system.
4. Dev server: Turbopack panics on `/admin` in this folder (trailing space in "Hedges Invitational "); local verification used `next dev --webpack`. `next build` is unaffected.
5. `exitQa` needs no admin cookie (it only ever removes a link whose player is `is_test`), so a QA device can always leave.

## Open issues
- Deploy and run the production two-device gate; then the cleanup SQL.
- `/schedule` tee-time cards → Brief 34; `/champions` Low Man / Skins King → Brief 36; the "delete-locked" message is now verified live (QA).
- `supabase/.temp/` (CLI scratch) is untracked; `next.config.ts` `allowedDevOrigins` is local-only and uncommitted.

## Follow-up: perspective regression tests (Oct 6, 2026)
Chris reported a suspected scoring inversion on production QA. Diagnosis (QA data only, same commit, live DB): **no bug** — in both formats, from both a North and a South seat, the lower score won, the banner named the right team, the header read "N 1 UP", and the strip tile was W for North / L for South. Every layer was checked (engine, adapter, A=North assignment in `score/page.tsx`, UI mapping). The one gap was that the banner / W-L tile / viewer-side mapping lived inline in the scorecard component with no test. That mapping is now pure functions in `engine/src/holeView.ts` (`viewerSide`, `holeBanner`, `holeTile`), used by the scorecard, with `holeView.test.ts` (14 tests: both formats, both seats, a hole South wins, a mercy-cap halve in each format, a picked-up partner, the N/S header). Mutation-checked: flipping tile W/L, the banner team names, the viewer side, or the engine's comparison each turns the suite red. 114 -> 128 tests.

