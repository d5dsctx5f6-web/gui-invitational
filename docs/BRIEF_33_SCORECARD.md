# BRIEF 33 (REVISED) — SCORECARD: SCRAMBLE + OPTIONAL BEST BALL, QA SANDBOX, GREEN BUILD

**Project:** The Hedges Invitational app · **Milestone:** v2 screen rebuild, 2 of 6 · **Issued:** Oct 6, 2026 · **Revision 2** (supersedes the first Brief 33 entirely)
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 32 closed and phone-verified (`41f444b`). Your Brief 33 Part 0 report has already been delivered and accepted; its findings are built into this revision. **Don't redo Part 0.**
**Gate:** the Vercel build is **green and deployed**. On the production URL, Chris plays two simulated QA matches across **two devices** (his phone and a second device), signed in as two different QA players: **one scramble match and one best-ball match.**
- scores posted on one device appear on the other within a few seconds
- F9/B9/18 status, the mercy cap, Drives Used (scramble only) and the reverse mulligan all behave as specified
- each finished match shows the exact points result its fixture predicts
- the format switch locks once a score exists
- the QA reset leaves zero QA data behind

No real player is ever signed in as.

---

## What changed in this revision

1. **New: Sunday can optionally be 2-man best ball.** Each round gets a format, scramble or best ball, set by an admin switch. It defaults to scramble and locks once any score is posted for that round. Best ball means each player plays his own ball, and the lower of the duo's two scores is the duo's score for the hole. It is still gross, still duo vs duo, still 3 points a match.
2. **Reverse mulligan rule confirmed, unchanged:** one per duo, per round.
3. **Part 0 findings decided:**
   - RLS read and write policies
   - the `can_score_duo()` helper
   - "updated by" tracking on scores
   - QA season year 1900
   - centralized `is_test`-filtered season and player helpers
   - Exit QA
   - a captain reset if needed

---

## Context (read once)

This is the screen the trip runs on: 16 guys, one-handed, mid-round, desert sun. Everything is in service of **posting a hole fast and never getting a match result wrong.**

**Competition rules this brief implements.** These are canonical. Part G writes them into the spec and rulebook.

- **Teams and matches:** North vs South. Duo vs duo match play, four matches per round, two rounds.
- **Points:** every match is worth 3 points: front 9, back 9 and overall 18. Win = 1, halve = ½.
- **No strokes, anywhere.** Gross only. Handicaps are captain intel only.
- **Formats** (per round, set by the commissioner):
  - **Scramble** (default; Saturday is always scramble): both partners tee off, the duo plays the better ball, and both play in from there. **One score per duo per hole.**
  - **Best ball** (optional, Sunday only in practice): each player plays his own ball for the whole hole. **The duo's hole score is the lower of its two players' scores.** A player who picks up when his partner's score already counts can be left blank. A duo needs at least one score to post the hole.
- **Mercy cap:** for match purposes, a duo's hole score counts as at most **par + 2**. Raw numbers are always stored as entered, and the engine applies the cap. In best ball, capping each ball and then taking the lower one gives exactly the same result as taking the lower one and then capping (`min(cap(a), cap(b)) = cap(min(a, b))`). The engine caps the duo's best score. Prove the equivalence in a test.
- **Reverse mulligan:** **one per duo, per round.** A duo forces the opposing duo to replay their last shot, and the replay result is the score. In best ball the replayed shot belongs to one opposing player, and his replay result is simply his score for the hole. The app records the event (calling duo, round, hole) and the used state. It needs no special score handling in either format.
- **Drives Used:** scramble rounds only. One optional tap per duo per hole for whose tee shot was played. **Hidden in best-ball rounds**, because everyone plays his own drive.
- **Format timing:** the app locks a round's format at the first posted score. The **rulebook** requires the commissioner to announce Sunday's format **before Pairings Night II**, because captains pair differently for best ball than for scramble.

**Decisions Chris already made:**
- Any of the four players in a match can post or edit both duos' scores, and log either duo's reverse mulligan call. The signed paper card is the backup.
- Drives Used is prompted, never required.
- No fall field test. Testing uses the QA sandbox (Part A), which the two-device gate, the February dress rehearsal and later briefs will all reuse.
- Built in the Brief 30 design system now.
- A green build is part of this brief (Part F).

---

## Scope — Part A: Migration (print one block at a time for Chris)

Chris pastes each block into the Supabase SQL editor and pastes back the output. Give him one block at a time in a code block, with the expected result, and wait for his output before giving the next. Keep it to as few files as is sensible.

**A1. Read and write policies (fixes the Part 0 bug).**
- Add `authenticated` SELECT policies on `duos`, `hole_scores`, `reverse_mulligans`, and the new `player_hole_scores` table (A3), alongside the existing `anon` ones. Signed-in devices currently read zero rows and get no realtime events.
- **`can_score_duo(duo_id)`**:
  - `SECURITY DEFINER` with a fixed `search_path`
  - returns true when the device's linked player (from `player_devices` via `auth.uid()`) is in either duo sharing that duo's round and slot
- **`hole_scores` and `player_hole_scores`:**
  - INSERT: `WITH CHECK can_score_duo(duo_id)`
  - UPDATE: both `USING` and `WITH CHECK`, so a write can't move a row to a duo, hole or round outside the player's match
  - DELETE: service-role only
- **`reverse_mulligans`:**
  - INSERT: `WITH CHECK can_score_duo(duo_id)`. Any of the four can log either duo's call, and the existing `unique (duo_id, round_id)` enforces one per duo per round.
  - DELETE: service-role only. That is the commissioner undo.
- **`duos`:** writes stay admin / service-role only.

**A2. Round format.**
- Add `rounds.format text not null default 'scramble' check (format in ('scramble', 'best_ball'))`.
- **Lock trigger:** reject any change to `rounds.format` once any `hole_scores` or `player_hole_scores` row exists for that round. Show a plain error such as "Format is locked — scores have been posted for this round."

**A3. Best-ball scores: new table `player_hole_scores`.**
- Columns:
  - `id`
  - `round_id` (FK rounds, ON DELETE RESTRICT)
  - `duo_id` (FK duos, ON DELETE RESTRICT)
  - `player_id` (FK players, no cascade)
  - `hole` (1–18)
  - `strokes int` (raw)
  - `updated_by_player_id`, `updated_at`
- Unique on `(player_id, round_id, hole)`.
- Integrity check, trigger or constraint: `player_id` must be player 1 or player 2 of `duo_id`, and the duo's round must match `round_id`.
- Add the table to the realtime publication. Apply the A1 policies.
- **Format integrity:** scramble rounds write only to `hole_scores`, and best-ball rounds write only to `player_hole_scores`. Enforce this with a trigger on both tables that checks the round's format, so the two can't be mixed.

**A4. "Updated by" tracking.**
- Add `updated_by_player_id` and `updated_at` to `hole_scores`. `player_hole_scores` gets them in A3.
- Set both with a trigger on insert and update, never by the client:
  - **player:** resolved from the device link
  - **service role** (admin Corrections): the player stays null, and the UI says "updated by the commissioner"

**A5. QA sandbox schema.**
- Add `players.is_test boolean not null default false` and `seasons.is_test boolean not null default false`.
- Seed the QA season: year 1900, "QA Sandbox", `is_test = true`. Give it its own North Hedges and South Hedges teams.
- Seed four QA players flagged `is_test`: "QA North 1", "QA North 2", "QA South 1", "QA South 2".

**A6. Captain reset**, only if Chris's Part 0 query showed a captain set: set both 2027 `captain_player_id` to null. Real captains get entered in admin later.

---

## Scope — Part B: Season and player isolation (centralized)

- **One helper for "current season":** the newest season where `is_test = false`. Route **every** season lookup through it, including:
  - `/champions`
  - `/schedule`
  - the home roster
  - the admin season lists
  - every write path that currently picks "the first season"
- **One helper for roster reads** that filters `is_test = false`. Use it in all ~10 player reads.
- The QA season is reachable only two ways: through a QA player's own duos, or an explicit admin season selector (QA sandbox and Corrections).
- **Enforce this in the data queries, not just the UI.** Tests: 2027 reads never return `is_test` players or QA rows, and the reverse.

---

## Scope — Part C: QA sandbox (admin-gated, works on production)

Admin → **QA sandbox**, behind the existing admin passcode:
- **Seed / reset (format: scramble | best ball).**
  - Wipes the QA season's data in RESTRICT-safe order: `player_hole_scores` → `hole_scores` → `reverse_mulligans` → `duos` → `rounds`.
  - Then recreates one QA round (round 1, O'odham Gold, read-only use of the real course data) in the chosen format, with one slot-1 match: QA North 1 + 2 vs QA South 1 + 2.
  - It must be impossible for the reset to touch a season where `is_test = false`. Assert this in code and in a test.
- **Open as QA player.**
  - Uses a service-role action to replace the current device's player link with the chosen QA player. Only `is_test` players are allowed.
  - **Exit QA** removes the QA link. Chris then re-enters his own PIN.
  - A device never holds a QA link and a real link at the same time.
- **Autofill from fixture:** posts the remaining unposted holes of the QA match from the pinned fixture for that round's format.
- **Two fixtures**, pinned in the engine test suite with expected results (each segment's winner and the total points), both using **O'odham Gold's real pars**:
  - **Scramble fixture:** a score above Max on at least one hole where the cap changes the result, a halved segment, and a reverse mulligan logged on one hole.
  - **Best-ball fixture:** at least one hole where the duo's two scores differ (the lower one counts), one hole where a player is left blank (picked up), one hole where both balls are above Max, a halved segment, and a reverse mulligan.

  Autofill and the tests use the same fixtures, so a phone result and a test result can't drift apart.

---

## Scope — Part D: The scorecard (`/score`), rebuilt for v2

Replace the v1 `score/page.tsx` and `Scorecard.tsx` entirely. Mobile-first and one-handed, built from Brief 30's tokens and primitives (`hedges-tokens.css`, Inter and Barlow Condensed, light and dark). Readable in direct sun. Every tap target is at least 44px.

**Finding the match:** the signed-in player's duo in the current round of their season, from `duos`. The match is the two duos sharing round + slot. If the player has no duo, show a plain empty state.

**Match header (always visible):**
- The two duos in team colors (North MSU Blue `#00205B`, South MSU Gold `#B9975B`).
- Slot, derived tee time in Arizona time (Brief 32's `first_tee_time` + interval), and a small format label ("Scramble" or "Best ball").
- **A compact F9 / B9 / 18 status readable at a glance** (Brief 23's pattern): "N 2 UP", "AS", a check mark plus the winner when a segment is decided, "½" when halved.

**Hole header:** hole number, par, yardage for the round's active tee, and **"Max N"** (par + 2), all prominent.

**Entry — scramble rounds:**
- Two big steppers, one per duo, defaulting to par. Typing is optional.
- **Drives Used:** per duo, two name buttons; tap to select, tap again to clear. A short-handed duo has its one player preselected. Optional.

**Entry — best-ball rounds:**
- Four steppers, two per duo, one per player, each defaulting to par. Each player also gets a "picked up" option that leaves his score blank.
- Each duo's counting score is shown live (the lower of the two, with the counting ball visibly marked).
- A duo needs at least one score to post. A short-handed duo shows one stepper.
- No Drives Used.

**Both formats:**
- **Above Max:** steppers allow it (the raw number is stored) and show "counts as N (mercy cap)" on the duo's counting score.
- **Post hole:** one atomic write of the hole's rows for both duos:
  - scramble: upsert `hole_scores` on `(duo_id, round_id, hole)`
  - best ball: upsert `player_hole_scores` on `(player_id, round_id, hole)`; a player marked picked-up has his row for that hole deleted or omitted, through a path that respects the delete policy

  Then advance to the next unposted hole.
- **Editing a posted hole:** reached from the hole strip, with a prominent result banner ("North won hole 7", "Hole 7 halved"). Saving re-upserts.
- **Write permission:** enforced by A1's RLS. The UI also hides entry for anyone not in the match.

**Reverse mulligan:**
- One button per duo: "Call reverse mulligan on [opponents]." It requires a confirm step.
- It records a `reverse_mulligans` row for the calling duo, round and current hole. The button then shows "Used · hole N" and is disabled for that duo for the rest of the round, on every device.
- Undo is commissioner-only, in Corrections. There is no special score handling.

**Scorecard view (collapsible, collapsed by default):**
- The W/L/H hole strip from the signed-in duo's perspective, with unposted holes muted. Tapping a tile jumps to that hole.
- Running totals per segment.
- Scramble: Drives Used tally per player. Best ball: each player's own gross total for the round, as bragging rights only, never used in scoring.

**Segments still live:** if the overall 18 closes early while the back 9 is open, say so ("18 decided — back 9 still live") and keep entry open through hole 18.

**Live updates:** posts from any device in the match appear on the others within a few seconds, through the existing `useRealtimeRefetch` hook filtered on `round_id`, covering whichever scores table the round's format uses. When a remote change lands on the hole you're viewing, show "Hole 7 updated by QA South 1" (or "by the commissioner").

**A failed post never vanishes.** Keep the entered values, show "Not saved — tap to retry," and never advance. A full offline queue is out of scope; the paper card is the backup.

**Engine:**
- Feed both formats into the existing `computeMatchState` / `resolveHoleResults` through one adapter:
  - **best ball:** player rows → per-duo lowest raw score per hole → the existing duo-score shape
  - **scramble:** passes through unchanged
- The cap stays inside the engine.
- **No second match-state implementation.** Keep the `/engine` isolation rule.

---

## Scope — Part E: Admin

- **Rounds:** add the format switch (Scramble / Best ball) per round. Once the lock trigger blocks a change, show the locked state with its plain message. Expected use is Sunday only, but don't restrict it to round 2.
- **Corrections** (replaces the section hidden in Brief 32), scoped to the selected season (2027 or QA):
  - pick round → match → hole
  - edit either duo's strokes (scramble) or any player's strokes (best ball), and Drives Used (scramble)
  - remove a reverse mulligan call (the only undo), with a confirm step
  - delete a hole's scores, which is required before a duo can be deleted under RESTRICT; verify the "This duo has scores" message live now that scores exist
- **QA sandbox:** as specified in Part C.

---

## Scope — Part F: Green build

- **`/leaderboard`, `/money`, `/duos`:** simple placeholders in the new design system ("being rebuilt — back soon"), with no data reads. They're rebuilt in Briefs 34, 35 and 36.
- **`/champions`, `/schedule`:** leave them working, now reading the current season through the Part B helper. Their remaining fixes are Briefs 36 and 34.
- Remove dead v1 code only where it blocks the build.
- Commit, push, and confirm the Vercel build is **green** and production serves it. Give Chris the URL.

---

## Scope — Part G: Docs (canonical rule changes)

**`GUI_INVITATIONAL_RULEBOOK_V2.md`:**
- **§5 The competition:** replace "2-man scramble, gross, both days" with:
  > **Format.** Saturday is a 2-man scramble: both partners tee off, play the better ball, both play in from there, one team score per hole. **Sunday is a scramble by default, but the commissioner may call 2-man best ball instead:** each player plays his own ball the whole hole, and the duo's score is the lower of its two. Either way it's gross, duo vs duo, 3 points a match. The commissioner announces Sunday's format before Pairings Night II, so captains can pair for it.
- **§5 reverse mulligan:** state it as "**one per duo, per round**," and add: "In best ball, the replayed shot belongs to one opposing player; his replay result is his score."
- **§5 mercy rule:** add "In best ball, the cap applies to the duo's counting score."
- **§6 Drives Used:** add "Scramble rounds only."
- **§1 schedule table:** mark Sunday as "Round 2 — Scramble or best ball (announced before Pairings Night II)."

**`PRODUCT_SPEC_V2.md` §2:** the per-round format (scramble default, best ball optional, admin switch that locks at the first score), best-ball scoring (lowest raw score per duo, picked-up players blank), Drives Used scramble-only, and the scorekeeping rule ("any of the four players in a match can post or edit both duos' scores and log either duo's reverse mulligan; Drives Used is never required").

**`ARCHITECTURE.md`:** `rounds.format`, `player_hole_scores`, the format-integrity and lock triggers, `can_score_duo` RLS, the updated-by triggers, the QA sandbox (`is_test`, Exit QA, reset safety), and the season and roster helpers.

**`BUILD_PLAN.md`:** note that Brief 37's print pack needs a **best-ball scorecard variant** (four player rows instead of two duo rows, no Drives Used row).

Write the session addendum, update `PROJECT_STATUS.md`, and copy everything changed to the Desktop project folder for Chris to upload to project knowledge.

---

## Scope — Part H: Tests

`/engine` stays free of framework and Supabase imports. Cover:
- both pinned fixtures → exact segment results and points
- the best-ball cap equivalence: `min(cap(a), cap(b)) = cap(min(a, b))` across a property-style sweep
- best ball with a blank player, and with a short-handed duo
- a raw score above Max stored raw and counted capped, in both formats
- segment liveness (18 closed early, back 9 open)
- write-permission rules as pure functions: a player in the match is allowed for both duos; a player in another match, another season, or a QA player writing to 2027 is denied
- the format lock: switching is allowed before any score exists, and blocked once one does
- QA reset refuses any season where `is_test = false`
- season and roster isolation in both directions

---

## Verification

1. Migration blocks printed one at a time with expected results; Chris pastes back the output for each.
2. `npx vitest` green (the existing 86 plus Part H), `/engine` isolation intact, lint clean.
3. **Build green**, production URL reported.
4. **Two-device gate on production.** Give Chris an exact tap-by-tap script covering both formats:
   - **Scramble:** QA sandbox → Seed / reset (Scramble). Device 1 opens as QA North 1, device 2 as QA South 1, both on `/score`.
     - Post holes 1–3 from device 1, edit hole 2 from device 2, and watch for the live updates and the "updated by" notice.
     - On a par 4, enter 9 and confirm "counts as 6."
     - Use Drives Used on some holes and skip it on others.
     - Call a reverse mulligan from device 2 and confirm it's disabled on both devices.
     - With airplane mode on, confirm "Not saved — tap to retry," then retry.
     - Autofill from fixture, and confirm the final points equal the pinned result.
   - **Format lock:** admin → Rounds, on the QA round. Try switching the format with scores present and confirm it's blocked with the plain message.
   - **Best ball:** QA sandbox → Seed / reset (Best ball).
     - Confirm four steppers and no Drives Used.
     - Enter different scores for the two partners and confirm the lower one is marked as counting.
     - Mark one player picked-up and confirm the hole still posts.
     - Enter 8 and 9 on a par 4 for both partners and confirm "counts as 6."
     - Autofill, and confirm the final points equal the pinned best-ball result.
   - **Corrections:** edit a QA hole and watch `/score` recompute, remove the mulligan, and try deleting a QA duo to confirm the "has scores" message.
   - **Exit QA** on both devices. Chris re-enters his own PIN on his phone.
   - QA sandbox → Seed / reset, then the cleanup SQL.
5. **Cleanup SQL** for Chris to paste: 2027 has 0 duos, 0 `hole_scores`, 0 `player_hole_scores` and 0 `reverse_mulligans`; no `is_test` player is on a 2027 team; both 2027 rounds still show `format = 'scramble'`; the QA season is back to freshly seeded.

## Close-out

Session addendum, `PROJECT_STATUS.md`, `ARCHITECTURE.md` reconciled, and copies to the Desktop project folder.

## Next

Brief 34: Cup leaderboard and matches view, plus the `/schedule` tee-time cards. It covers the live North-vs-South total and all four matches per day with hole strips, in either format. It also builds the data feed the physical big board and an optional TV mode will mirror.
