# BRIEF 16 — FIX: LEADERBOARD SCORE DISPLAY (TO-PAR, NET + GROSS)

**Project:** The GUI Invitational app · **Type:** display fix, punch-list item · **Issued:** Jul 23, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 15 shipped (stale data cleaned, admin rounds reorganized).
**Gate:** the individual race shows each player's score **relative to par** (E / +N / −N, standard golf convention) rather than a raw cumulative stroke count — and shows both **net** and **gross** for each player, not just one blended number.

---

## Context (read once)

Chris caught that the leaderboard's individual race is showing raw cumulative net strokes with a flat "+" prefix (e.g., "+16" for Cam Delaney through 3 holes) rather than score relative to par. This reads as alarming/confusing — "+16" looks like 16 over par, when it's actually just his raw net total (which happens to equal his gross, since he has no handicap index on file yet). The correct, standard golf convention is **score-to-par**: even is "E", over is "+N", under is "−N" — computed as (score so far) − (par of the holes actually played so far).

This was actually the original design — `gui_invitational_mockup.html`'s individual race section always used this to-par convention (`"−4"`, `"E"`, `"+1"`, etc.), and Brief 14's real implementation deviated from it by displaying raw totals instead. This brief restores the intended display and adds the gross/net transparency Chris now wants on top of it.

Grounding: `gui_invitational_mockup.html` `scr-ind` (the original to-par display convention), `BRIEF_14_LIVE_LEADERBOARD.md` (what's currently built), the `course_tees.par_by_hole` column (already in the schema since Brief 3/M1 — `par_by_hole int[]`, needed to compute par-of-holes-played).

---

## Scope — Part A: Net-to-par, not raw net

- For each player, compute **par of the holes they've actually posted a score for so far** (sum `par_by_hole` for those specific holes, from the round's course/tee setup) — not a flat 18-hole par, since players are mid-round at different hole counts.
- Display **net-to-par** = (cumulative net strokes) − (par of holes played), formatted the standard way:
  - `0` → **"E"**
  - positive → **"+N"**
  - negative → **"−N"** (use an actual minus/en-dash, not a hyphen misread as a range, per the mockup's convention)
- This becomes the primary number used for ranking (lower is still better — same ordering logic as before, just displayed correctly).
- If this calculation belongs in the engine (`computeIndividualRace()` or a small addition alongside it) rather than the UI — per ARCHITECTURE's "engine computes, UI renders" principle — extend the engine output to include par-of-holes-played (or net-to-par directly) rather than computing it ad hoc in the component. Use judgment on the cleanest place for this without over-engineering a display concern.

## Scope — Part B: Show gross alongside net

- Add the player's **gross** score to the same row/card — Chris wants both visible, not just net used silently. A reasonable layout: net-to-par as the primary/larger figure (since it's what the race is actually decided on), gross shown alongside as a secondary value — either raw gross total or gross-to-par (using the same E/+/− convention for consistency). Default to **gross-to-par**, matching the net formatting, unless that reads confusingly once built — note the choice made in the addendum.
- This mirrors real golf leaderboards (net and gross both commonly shown) and directly serves Chris's "make handicaps visible/understandable" goal from the ongoing simplification pass.

## Scope — Part C: Apply consistently

- Check the Cup/team-standings side of the leaderboard and the scorecard's "Running Totals" card for the same raw-vs-to-par question — if either has the same issue (showing raw totals where to-par would be clearer/more standard), fix consistently. If they're fine as-is (e.g., the scorecard's gross/net running total is arguably fine as a raw count for a scorekeeper's purposes, not a ranking display), leave them — use judgment, don't change things that aren't actually confusing.

---

## Verification

1. Individual race shows net-to-par with correct E/+/− formatting — spot-check against a hand calculation (e.g., Cam Delaney's 3 holes at par 4/4/5 with 5/5/6 strokes, 0 dots → net-to-par should read "+3", not "+16" or "16").
2. Gross is visible alongside net for every player.
3. Ranking order is unaffected (same underlying comparison, just relabeled/reformatted correctly).
4. No regression: realtime updates still work: post a hole, confirm the to-par figure updates correctly, not just the raw total; all engine tests still green.

## Close-out

Short session addendum, to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` — closes this display item from the punch list.
