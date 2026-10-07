# BRIEF 34 — CUP LEADERBOARD, MATCHES VIEW, TV BOARD + PRESSURE-TEST PROTOCOL

**Project:** The Hedges Invitational app · **Milestone:** v2 screen rebuild, 3 of 6 · **Issued:** Oct 6, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 33 closed and verified on production (`3b3c3e0`, 128 tests). That gives us the scorecard in both formats, the QA sandbox, RLS score writes, and the season and roster isolation helpers.
**Gate:**
1. **Claude Code's adversarial pressure test** (Part F) passes in full: every attack is run, every result is reported with evidence, and 2027 is proven untouched.
2. Then a **short phone and TV look-and-feel check** by Chris on production.

Claude Code does the heavy verification; Chris confirms it feels right.

---

## Context (read once)

The scorecard answers "how's *my* match going." This brief answers **"who's winning the Cup?"** for all 16 guys, all weekend: on their phones, and on a TV at the house.

**Rules this screen implements** (GUI_INVITATIONAL_RULEBOOK_V2 §5 and §8; PRODUCT_SPEC_V2 §2):
- **North vs South.** Four duo matches per round, two rounds.
- **Points per match:** 3 (front 9, back 9, overall 18). Win = 1, halve = ½. **24 points total**, and most points wins the Cup.
- **Possible points per round = matches actually played × 3.** Never hardcode 12, because a short-handed round can have fewer matches.
- **Tiebreak:** points first, then total holes won across the trip. If still tied, the engine flags **"chip-off required."** It never auto-resolves. The commissioner records the winner in `seasons.chip_off_winner_team_id`.
- **Shortened event:** if Sunday can't finish, the Cup goes to the standings after the last *fully completed* round.
- **Rounds can be scramble or best ball** (Brief 33). Everything here works for either, through the existing scoring adapter.

**What already exists:** `computeMatchState` (per-match F9/B9/18 and points), two-team standings with the tiebreak ladder and chip-off flag (Brief 31), shortened-event resolution, the `buildMatchHoles` adapter for both formats, and the `holeView` perspective functions. **Reuse all of it. Build no second scoring path.**

---

## Scope — Part 0: Short diagnose, report, then stop

1. Confirm the exact standings, tiebreak, chip-off and shortened-event functions and their signatures. Do they take possible points from matches played, or is 12 baked in anywhere?
2. Report what the `/leaderboard` placeholder and `/schedule` read today.
3. Explain how the QA sandbox would need to grow to seed **two rounds and four matches each** (Part E).
4. List anything that contradicts this brief.

Stop for Chris's confirmation.

---

## Scope — Part A: `/leaderboard` — the Cup

Mobile-first, in the Brief 30 design system, readable in sun. It shows the current non-test season through the Part B helper from Brief 33.

**Cup header (always at top):**
- **North vs South points**, big, in team colors (MSU Blue `#00205B`, MSU Gold `#B9975B`), using `formatPoints` (½ glyph).
- **"X to win."** When the full 24 are in play, that's 12½; otherwise it's derived from possible points. If a team has clinched, show "North Hedges retain/win the Cup" or similar.
- **Live projection line, clearly labeled "If it ended now":** official points plus the projected result of every in-progress match at its current status (Ryder Cup broadcast style). The projection is never mixed into the official total.

**Rounds:** one section per round (Saturday, Sunday) showing the format label, the course, and "N of M points decided."

**Match cards (four per round):**
- Both duos' names in team colors.
- Derived tee time (Arizona time).
- Live status: "N 2 UP thru 11," "AS thru 6," "Not started," or a final like "N wins 2½–½."
- The F9/B9/18 segment chips, using `segmentLabel`.
- Tapping a card opens the match detail.

**Match detail (`/leaderboard/match/[round]/[slot]` or equivalent), read-only for everyone:**
- The full W/L/H hole strip from a neutral perspective (team-colored tiles, not W/L), with each duo's counting score per hole.
- The mercy cap, shown where it changed a hole.
- Reverse mulligan calls (which duo, which hole).
- Drives Used tally in scramble rounds.

**Edge states, each with a plain message:**
- before Pairings Night (no duos yet)
- a round not started
- a short-handed match
- **"Chip-off required"** banner on a level finish, and the winner once the commissioner records it
- **"Shortened event — standings after Saturday"** when the shortened rule applies

**Live:** updates arrive within a few seconds through the existing realtime hook, across every scores table in the season.

**Admin:** add **record chip-off winner** (team picker, with a confirm step). It's visible only when the engine flags a chip-off.

---

## Scope — Part B: `/board` — the TV board

The digital version of the big board, made to sit on a TV at the house.

- **Landscape, large type, readable from across a room,** with no scrolling at 1080p.
- **Content:**
  - the Cup score, big
  - both rounds' matches with live status and segment chips
  - the "If it ended now" projection
  - a format label per round
- **Real-time:** it updates without interaction and survives being left open for hours (reconnect on drop, refetch on focus). Show a small "last updated" timestamp so a frozen screen is obvious.
- **No login required, read-only, and no admin links** on it.
- Dark theme by default (TVs look better in dark), with a light toggle.

---

## Scope — Part C: `/schedule` tee-time cards

Fix the cards Brief 32 noted as missing:
- Saturday and Sunday rounds come from `rounds`: date, course, active tee, format, `first_tee_time` + interval, and the four group times in Arizona time.
- Show matchups per group once duos exist.
- Show the "Pending confirmation" note when it's set.
- Friday's Silverado schedule item stays as-is.

---

## Scope — Part D: Engine additions (pure, tested, in `/engine`)

- **`cupStandings(season)`:**
  - official points per team
  - possible points (matches × 3)
  - points to win
  - a clinched flag
  - the tiebreak result (points → holes won → chip-off flag)
  - the shortened-event determination
- **`projectedStandings(season)`:** official points plus each in-progress match's segments projected at their current status (a segment currently up projects as a win, all square projects as a halve).
- **`matchCardStatus(match)`:** the display status string and final-result string.
- **Rule for every function:** possible points always come from the matches that exist, never a constant.

---

## Scope — Part E: QA sandbox — full-trip mode

Extend Brief 33's sandbox. Keep its single-match mode working.

- **Seed full trip:**
  - **16 QA players** (`is_test`): 8 North, 8 South
  - **two QA rounds** (round 1 scramble on O'odham Gold, round 2 with a format the caller chooses on Saguaro Purple)
  - **four matches per round**

  Same isolation and RESTRICT-safe reset rules as before. The reset must refuse non-test seasons.
- **Scenario fixtures,** each pinned in the test suite with its expected Cup result, and each loadable on demand from admin and from a terminal script:
  1. **Normal finish:** one team wins outright.
  2. **12–12 tie:** points level, broken by total holes won.
  3. **Dead level:** points and holes won both tied, so "chip-off required" shows.
  4. **Shortened event:** Saturday complete, Sunday partial, so standings after Saturday decide it.
  5. **Short-handed:** one round with three matches, so possible points are 21, not 24.
  6. **Mid-round live:** some matches in progress, to drive the projection.
- Admin → QA sandbox: **Seed full trip**, **Load scenario 1–6**, and **Open as any QA player.**
- `/leaderboard` and `/board` must be viewable in **QA scope** (for example, behind an admin-gated `?scope=qa` or a QA-session-only toggle) so Chris can see the scenarios on his phone and TV. They must **never** show QA data in the default real view.

---

## Scope — Part F: Adversarial pressure test (Claude Code runs this; it is the main gate)

Claude Code attacks its own work from the terminal and reports evidence. This is a standing protocol, so also write it up as **`docs/PRESSURE_TEST_PROTOCOL.md`**, which every later brief will reference.

**F1. Mutation testing.** Deliberately break each of these one at a time, confirm the test suite fails, then restore and confirm a clean diff. Report a table of each breakage and the number of failing tests.
- points tally (count a halve as 1)
- possible points hardcoded to 24
- tiebreak order (holes won before points)
- chip-off auto-resolving instead of flagging
- shortened event using the partial round
- projection mixed into official points
- the mercy cap removed
- an engine comparison flipped (higher wins)
- the perspective tile flipped
- the QA scope filter removed (QA rows leak into real reads)

If any breakage doesn't fail the suite, add the missing test before continuing.

**F2. Live end-to-end against the real database (QA scope only).** Using terminal scripts that sign in as QA players through the **same RLS write path the phones use** (not the service role, except for seed and reset):
- Run all six scenarios. For each, confirm the **live** `/leaderboard` and `/board` output (fetch the rendered pages or their data) matches the pinned expected result exactly.
- **Permission attacks (each must be denied, with the database error captured):**
  - a QA player writes to another QA match
  - a QA player writes to a 2027 duo
  - a signed-out device writes
  - a player deletes a score
  - a player calls a second reverse mulligan for the same duo and round
  - a player changes a locked round's format
- **Concurrency:** two QA sessions post the same hole within the same second. The final stored value must be one complete write (never a mix), and both clients must converge to it. Measure and report realtime delivery time to a third subscribed session over 20 posts (median and worst).
- **Isolation:** after all scenarios, prove 2027 still has 0 duos, 0 scores of either kind, 0 mulligans, and no QA players on 2027 teams. The default `/leaderboard` and `/board` must show no QA data.

**F3. Report.** A pass/fail table for every F1–F2 item with evidence (counts, error text, timings). Reset QA afterward and prove it's clean. Any failure is fixed and re-run before the gate. Never leave one as "noted."

---

## Scope — Part G: Docs

- `docs/PRESSURE_TEST_PROTOCOL.md`: the reusable F1–F3 protocol, written generically so later briefs say only "run the pressure-test protocol for this brief's scope."
- `PRODUCT_SPEC_V2.md` §2: the "If it ended now" projection (display only, never official), and the `/board` TV view.
- `ARCHITECTURE.md`: the QA full-trip mode, QA scope viewing, and the new engine functions.
- `BUILD_PLAN.md`: Brief 37's print pack can mirror the `/board` layout for the physical big board.
- Session addendum, `PROJECT_STATUS.md`, and copies to the Desktop project folder.

---

## Verification (the gate)

1. Part 0 report confirmed before code.
2. Any migration goes one code block at a time with its expected result. Chris pastes it into Supabase and pastes back the output.
3. `npx vitest` green, `/engine` isolation intact, lint clean, `next build` green, production deploy READY.
4. **Part F report:** every item passes, with evidence. This is the main gate.
5. **Chris's phone and TV check on production** (keep it short; the logic was proven in F):
   - Admin → QA sandbox → Load scenario 6 (mid-round live). Open `/leaderboard?scope=qa` on the phone: Cup header, projection line, match cards, then tap into a match detail.
   - Open `/board` in QA scope on a TV or laptop screen across the room. Is it readable from the couch?
   - Load scenario 3: the chip-off banner shows. Load scenario 5: it shows "of 21." Load scenario 4: the shortened-event banner shows.
   - Open `/schedule`: the tee-time cards show.
   - Reset QA. Open the default `/leaderboard`: it's empty-state only, with no QA data.
6. Cleanup SQL for Chris to paste, with expected results.

## Next

Brief 35: the Pairings Night board. That's the live declare-and-counter draft, the coin-flip order (Sunday reverses Friday), the auto-filled fourth match, the commissioner short-handed override, and announcing Sunday's format before Pairings Night II. It runs the pressure-test protocol.
