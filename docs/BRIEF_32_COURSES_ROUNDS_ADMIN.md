# BRIEF 32 — COURSES, ROUNDS + ADMIN SEEDING (v2)

**Project:** The Hedges Invitational app · **Milestone:** first of the v2 screen-rebuild briefs (reordered: scorecard-first) · **Issued:** Oct 6, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 31 closed (v2 schema live in Supabase, 60/60 tests green); Brief 30 design system (CSS Modules + `hedges-tokens.css`)
**Gate:** on Chris's **phone**, `/admin` shows both trip courses with correct pars and yardages, Sunday's tee can be switched Purple ↔ White without affecting anything competitive, Saturday/Sunday tee times render in Arizona time, and a test North-vs-South duo pairing can be created, viewed, and deleted. All engine tests green, including the new course-data tests below.

---

## Context (read once)

**The build order changed.** The August plan put the Pairings Night board next. Chris has reordered the rebuild **scorecard-first** so the app can be field-tested on a real round before the Bozeman season closes. The draft is a single March evening and can wait; an untested scorecard can't. New sequence:

| # | Brief |
|---|---|
| **32** | **Courses + rounds + admin seeding (this brief)** |
| 33 | Scorecard rebuild — duo scramble entry |
| 34 | Cup leaderboard + matches view (likely turns the build green) |
| 35 | Pairings Night board |
| 36 | Ledger presets + Rulebook v2 copy in-app |
| 37 | Print pack — pre-printed scorecard PDFs + printable Cup board |

This brief is the foundation the scorecard needs: **real course data, real rounds, and an admin path to put duos on the course.** The admin duo form is a stopgap until Brief 35's Pairings Night board exists. After that it stays as the commissioner's override, which the short-handed rule requires (the commissioner sets the match count live; points derive as matches played × 3).

**Why pars matter more than anything else here:** match play is gross, and the mercy cap is `min(strokes, par + 2)`. A wrong par silently changes match results. Rating, slope, and stroke index are display-only now (captain intel). Get them right, but a wrong value can't change a result.

**Courses are locked:**
- **Friday Mar 26:** Scottsdale Silverado. Fun round, itinerary only, never scored. Tee times are booked on GolfNow ~mid-Nov.
- **Saturday Mar 27 (Cup Day 1):** Talking Stick, O'odham course, **Gold tees**.
- **Sunday Mar 28 (Cup Day 2):** WeKoPa, Saguaro course. Load **both Purple and White**; Purple is the default and Chris decides closer to the trip.

---

## Scope — Part 0: Ground in the real state first (diagnose before building)

Project knowledge has drifted from the repo, so report the actual state before writing code:

1. Read `PROJECT_STATUS.md`, `PRODUCT_SPEC_V2.md`, `GUI_INVITATIONAL_RULEBOOK_V2.md`, and the Brief 31 session addendum from `/docs`.
2. Report the current shape of `courses`, `course_tees`, `rounds`, and wherever **tee times** live (Brief 17 built tee-time slotting, and Brief 31 dropped `rounds.format`). Confirm what now carries day identity: date, a round-order column, or nothing yet.
3. List which existing admin sections compile against the v2 schema and which are broken.
4. Report every existing `courses`/`rounds` row and anything that references it, including the M1 demo course and pre-v2 test rounds. **Do not delete any row that anything references.** The archived pre-v2 data came from these tables, so retire stale rows with an `is_active`-style flag or leave them alone, then report what you chose.

If anything here contradicts this brief, stop and report rather than picking one.

---

## Scope — Part A: Course data (idempotent seed migration)

One migration file that **upserts** (safe to re-run) into the existing `courses` / `course_tees` structure. Store per-hole par, yardage, and stroke index in whatever shape `course_tees` already uses. Data below was cross-checked across multiple published scorecards. **Pars agree across every source.**

### Talking Stick Golf Club — O'odham — Gold tees
Rating 69.9 · Slope 119 · Par 70 · 6,510 yds

| Hole | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Out |
|---|---|---|---|---|---|---|---|---|---|---|
| Par | 4 | 5 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 35 |
| Yds | 379 | 509 | 417 | 390 | 356 | 187 | 427 | 143 | 412 | 3220 |
| SI | 15 | 13 | 1 | 3 | 11 | 5 | 9 | 17 | 7 | |

| Hole | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | In |
|---|---|---|---|---|---|---|---|---|---|---|
| Par | 4 | 3 | 4 | 4 | 4 | 4 | 3 | 5 | 4 | 35 |
| Yds | 390 | 217 | 358 | 356 | 410 | 425 | 161 | 534 | 439 | 3290 |
| SI | 12 | 6 | 2 | 16 | 8 | 14 | 18 | 4 | 10 | |

### WeKoPa Golf Club — Saguaro — Purple and White tees
Par 71 for both tees; per-hole par and stroke index are identical across tees.
- **Purple:** Rating 70.2 · Slope 132 · 6,603 yds
- **White:** Rating 68.8 · Slope 125 · 6,252 yds

| Hole | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Out |
|---|---|---|---|---|---|---|---|---|---|---|
| Par | 4 | 4 | 4 | 5 | 3 | 4 | 4 | 5 | 3 | 36 |
| Purple | 443 | 299 | 383 | 609 | 159 | 406 | 305 | 498 | 130 | 3232 |
| White | 426 | 288 | 362 | 595 | 146 | 380 | 290 | 482 | 121 | 3090 |
| SI | 5 | 11 | 9 | 1 | 15 | 7 | 13 | 3 | 17 | |

| Hole | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | In |
|---|---|---|---|---|---|---|---|---|---|---|
| Par | 4 | 3 | 4 | 4 | 5 | 3 | 4 | 4 | 4 | 35 |
| Purple | 322 | 194 | 461 | 457 | 527 | 233 | 315 | 372 | 490 | 3371 |
| White | 306 | 176 | 423 | 417 | 513 | 209 | 290 | 358 | 470 | 3162 |
| SI | 14 | 18 | 6 | 8 | 2 | 16 | 12 | 10 | 4 | |

**Seed-time assertions (fail the migration or test if any is false):** each tee has 18 holes; per-hole pars sum to the stated course par (70 / 71); yardages sum to the stated totals (6,510 / 6,603 / 6,252); stroke indexes are a permutation of 1–18.

Silverado gets **no** course row. It is a schedule/itinerary item only.

---

## Scope — Part B: Rounds + tee times

- **Saturday round:** date `2027-03-27`, course O'odham, tee **Gold**.
- **Sunday round:** date `2027-03-28`, course Saguaro, default tee **Purple**, admin-switchable to **White**.
- Day identity comes from an explicit round-order column or the date, never from a format field (dropped in Brief 31). Use whatever Part 0 found, or add `round_number int` if nothing exists.
- **Tee switch is display-only by construction.** Scoring is gross, and both Saguaro tees share identical pars. Switching changes yardage and the captain-intel course-handicap numbers, and nothing competitive. Add an engine test that proves it: identical duo scores produce identical match state under Purple and White.
- **Tee times**, admin-editable, rendered in **`America/Phoenix`**:
  - Saturday: first tee **11:00 AM**, four consecutive groups. Chris requested this and Talking Stick hasn't confirmed it, so the admin view should show a "pending confirmation" note.
  - Sunday: first tee **11:40 AM**, four groups. WeKoPa's confirmation shows both 11:40 and 12:40; Chris is confirming. Same note.
  - The group interval is admin-editable. Default to 10 minutes unless Part 0 finds an existing convention.
  - Friday Silverado: a schedule item with the time TBD.

**Timezone trap:** in late March, Montana (MDT) and Arizona (MST, no DST) are both UTC−7, so a timezone bug is **invisible from Chris's phone in Bozeman**. Verify by asserting the stored UTC value (`2027-03-27T18:00:00Z` for 11:00 AM Saturday). Also check rendering in a test with a different timezone, such as `America/New_York`.

---

## Scope — Part C: Admin (rebuilt against v2, in the Brief 30 design system)

Rebuild only the admin sections this phase needs. Mobile-first, one-handed, readable in sunlight: Chris will run this from his phone.

1. **Courses and tees.** View and edit course, tee, and per-hole par/yardage/SI. Editing a par shows a clear warning that pars drive the mercy cap.
2. **Rounds.** Per round: course, active tee (Sunday's Purple/White switch lives here), tee times, and pending-confirmation notes.
3. **Teams.** North Hedges and South Hedges are fixed and structural, not editable names. Assign a captain and add/remove `team_members`. Captains and rosters are data entered here, never hardcoded.
4. **Duos per round (the stopgap pairing form).**
   - Create a duo: round, team, player 1, player 2 (nullable, short-handed), `match_slot`.
   - A match is derived: a North duo and a South duo that share round + slot. There is no separate matches table (Brief 31).
   - **Validation:**
     - A player can't be in two duos in the same round.
     - Both players must be on the duo's team.
     - A slot holds at most one North and one South duo.
     - A null player 2 is allowed but shows a visible "short-handed" badge.
     - The slot count isn't forced to 4, per the short-handed rule.
   - Edit and delete duos. Deleting a duo that already has `hole_scores` must be blocked with a clear message rather than cascading or orphaning. This is the existing FK cascade punch-list item, re-checked now that scores hang off `duo_id`. Report what the FK actually does today.

Keep the admin passcode model from Brief 6 unchanged.

---

## Scope — Part D: Tests

Add the following to the existing Vitest suite. Keep the `/engine` isolation rule: course data enters as fixtures, with no Supabase imports.
- Course fixtures for all three tee sets, matching Part A exactly, plus the seed-time assertions.
- **Max (mercy cap) row:** `cappedStrokes` produces par+2 per hole for both courses. Spot-check O'odham hole 2 (par 5, max 7) and Saguaro hole 9 (par 3, max 5).
- Tee-switch invariance (Part B).
- Tee-time UTC storage and Phoenix rendering, as described in the timezone trap above.
- Duo validation rules from Part C, written as pure functions where possible so they're testable without the database.

---

## Scope — Part E: Docs (record the paper rule)

Chris decided how paper scorecards work alongside the app. Add the following to `GUI_INVITATIONAL_RULEBOOK_V2.md` §8 (Contingencies) and `PRODUCT_SPEC_V2.md` §2:

> **Paper scorecards.** Every foursome carries a printed card and marks it each hole. The app is canonical for live scoring and standings. At the end of the round, both duos sign the card. If the signed card and the app disagree, the commissioner reconciles to the signed card through admin.

Also:
- Rewrite `BUILD_PLAN.md`'s remaining milestones to the 32–37 order above. Keep the field test, the two-device live gate, the February dress rehearsal, and the **Mar 1, 2027 feature freeze**.
- Note in `PROJECT_STATUS.md` that the 7-player rule is **resolved** (August: commissioner live discretion, points = matches played × 3). It had been incorrectly listed as blocking.
- Copy current versions of `PRODUCT_SPEC_V2.md`, `GUI_INVITATIONAL_RULEBOOK_V2.md`, `BUILD_PLAN.md`, `PROJECT_STATUS.md`, and the Brief 31 and Brief 32 addenda to the Desktop project folder. Chris needs to upload them to project knowledge, which is still on the July v1 docs.

---

## Verification

1. Part 0 report delivered **before** any code, including the course/round row inventory and the FK behavior on `hole_scores → duos`.
2. Seed migration printed for Chris to run in the Supabase SQL editor (migrations are manual, per standing rule). It re-runs cleanly a second time with no duplicates.
3. `npx vitest` green: the existing 60 plus every new test above. Zero framework/Supabase imports in `/engine`.
4. **On Chris's phone** (admin writes verified against the live Supabase instance, per standing rule):
   - `/admin` → Courses: O'odham Gold shows par 70 and 6,510; Saguaro Purple shows 71 and 6,603; White shows 71 and 6,252. Spot-check holes 2, 9, and 17 on each against the tables above.
   - Rounds: Sunday's tee switches Purple → White → Purple, and the yardage display follows.
   - Tee times show 11:00 AM Saturday and 11:40 AM Sunday, each with its pending note.
   - Teams + duos: add two throwaway players to each team for this test only (no signing in as real players), create a Saturday slot-1 North-vs-South pairing, confirm the double-booking validation fires, then delete the pairing and the throwaway players.
5. Expected: the Vercel build may stay red because the scorecard, leaderboard, and pairings screens are still v1. Report exactly which routes still fail, so Brief 33's scope is concrete.

## Close-out

- Session addendum (shipped / commits / deviations / open issues) to the Desktop project folder and `/docs`.
- Update `PROJECT_STATUS.md`.
- Reconcile `ARCHITECTURE.md` §5 with any schema change made here (for example, `round_number`).

## Next

Brief 33 — scorecard rebuild: duo scramble entry (one number per duo per hole), drive-used tap, reverse mulligan call, the Max (par+2) value shown per hole, and live F9/B9/18 match status, built against this brief's course data and the Brief 30 design system. That's the field-test build.
