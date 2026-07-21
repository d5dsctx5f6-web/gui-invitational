# BRIEF 5 — ENGINE: STANDINGS, PAIRINGS, SHORTENED EVENT + THE M2 SUITE

**Project:** The GUI Invitational app · **Milestone:** M2 (the gate) · **Issued:** Jul 21, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 4 complete (skins, reverse-mulligan two-score, individual race — all pure, 34 tests green).
**Gate (M2):** the full simulated-full-trip test suite is green, AND Chris hand-audits one simulated trip's standings / skins / individual race against the engine's output and they match. When this passes, **the entire scoring engine is complete and proven before a single real hole is scored on the trip.**

---

## Context (read once)

This is the capstone of the scoring engine. Briefs 2 and 4 built the pieces — match state (F9/B9/18), handicap/dots, skins, the reverse-mulligan two-score rule, the individual race — each tested in isolation. **Brief 5 adds the last derived layers and then assembles everything into one full-trip simulation** that exercises every rule together. That assembled suite is the M2 gate.

Everything stays pure `/engine`: `(events, courseSetups, config) → derived state`. No I/O, no framework imports, no Supabase client. The isolation rule has held through four briefs — keep it.

Grounding: `PRODUCT_SPEC.md` §2 (canonical), `PRODUCT_SPEC_ADDENDUM_A.md` (the locked decisions — allowance 100%, skins paid nightly, **no ties: chip-off is the universal final resolver**), `GUI_INVITATIONAL_RULEBOOK.md` v1.6 (the human rules, esp. the clarified reverse mulligan), `ARCHITECTURE.md` §3–4, `TESTING_AND_HARDENING.md` (Layer 1 — this brief builds the suite that Layer 1 describes).

**Decisions from Addendum A this brief encodes:**
- **Allowance = 100%** both formats, wired as a formal config knob (default 1.0, adjustable to 0.9 etc. without code change). This brief turns the Brief 2 "hook" into a real config value threaded through net computation.
- **No ties, ever.** Every standings computation applies automatic tiebreakers, and if a true tie survives, the engine emits a **`chipOffRequired`** state naming the tied parties — it never breaks the tie itself. The chip-off result is later entered as an admin decision (M3); the engine just surfaces the need.

---

## Scope — Part A: Team standings & the cup

A pure function: all match results across both rounds → team standings and the cup outcome.

- **Points rollup:** each duo match yields F9/B9/18 segment points (win 1, halve ½) from the Brief 2 match engine. Sum across all matches a team played → cumulative team points (24 max). Order teams by points.
- **The cup:** the standings leader wins the cup. Apply the tiebreaker ladder (Addendum A) when teams are level:
  1. Most cumulative points.
  2. Head-to-head, *if the tied teams played each other* (they may not have, given only two rounds — handle "didn't meet" gracefully by skipping to the next criterion).
  3. Total individual holes won across the trip.
  4. If still tied → **`chipOffRequired`** listing the tied teams. Do not resolve in code.
- Output: ordered standings with points, the cup winner (or a chip-off-required flag), and enough breakdown (points, head-to-head, holes won) for the UI to show *why* the order is what it is.

## Scope — Part B: Earned Sunday pairings

A pure function: Saturday standings → Sunday's four-ball matchups.

- **1st plays 2nd, 3rd plays 4th** in the Saturday standings.
- This ladder **must produce a strict order** — you can't run Sunday without knowing who plays whom. Apply the same automatic criteria (points → head-to-head → holes won); if a seeding tie survives, emit **`chipOffRequired`** for the seeding decision (Addendum A allows a commissioner's call here if a chip-off is impractical the night before — either way the engine surfaces the tie and the resolution is entered as admin input, not computed).
- Count-agnostic and robust to Saturday being incomplete (see Part C — if Saturday didn't finish, pairings may be undetermined; handle without crashing).
- Output: the two Sunday matchups (or a chip-off-required flag for the ambiguous seed), derived purely from standings.

## Scope — Part C: Shortened-event resolution

Per SPEC §2 and Rulebook §7: if Sunday can't be completed (weather, departures), the cup and individual title are decided on **the standings after the last fully completed round.**

- A function/config that computes the official result given "how far did we actually get":
  - Both rounds complete → normal full-trip result.
  - Saturday complete, Sunday partial or not started → cup and individual title decided on Saturday standings alone.
  - Define "fully completed round" precisely (all matches in that round have all 18 holes for all present players — reconcile with count-agnostic absence: a round is complete when every *participating* player-hole that should exist, does).
- This is mostly a determination of *which* rounds count, then running Parts A/B and the individual race over that subset. Don't duplicate logic — parameterize it by the set of completed rounds.
- Output: the official standings/cup/title as of the last complete round, clearly labeled as full vs shortened.

## Scope — Part D: Allowance config knob

- Turn the Brief 2 allowance hook into a real config value: `allowance` (default **1.0**), applied in course-handicap → strokes-received so net = `gross − round(courseHandicap × allowance)` allocated by stroke index (confirm the rounding/allocation order matches Brief 2's dots logic — allowance multiplies the course handicap *before* stroke allocation).
- Per-format capability: config should allow a single global value now (1.0) but be structured so per-format values (shamble vs four-ball) are a config change, not a code change, later.
- Existing Brief 2 handicap tests must still pass with allowance = 1.0 (it should be a no-op at full handicap). Add a test proving allowance = 0.9 reduces strokes correctly on a known case.

## Scope — Part E: THE FULL SIMULATED-TRIP SUITE (the M2 gate)

This is the point of the brief. Build one comprehensive, readable test scenario: **16 players, 4 teams, both rounds, every rule firing together** — the "does the whole machine work as one" proof that no isolated unit test gives.

Construct a full fixture trip:
- 16 players with a spread of indexes; 4 teams of 4; a shamble Saturday and a four-ball Sunday on seeded course setups (reuse/extend the demo course, or a second one, to exercise per-course handicap conversion).
- Duo submissions for both rounds (duos reshuffled Sunday, to prove that path).
- A full set of hole scores across all four matches per round — realistic, hand-constructable, with known expected outcomes.

The suite must assert, all together:
- **Match state** across all matches → correct F9/B9/18 and points.
- **Team standings & cup** → correct order and winner; include at least one fixture that forces a tiebreaker criterion, and one that forces `chipOffRequired`.
- **Earned Sunday pairings** → correct 1v2 / 3v4 from Saturday standings.
- **Individual race** → correct cumulative net and daily lows across both rounds.
- **Skins** → both rounds (paid nightly, independent pools); include a carryover chain and a non-entrant-invisibility case.
- **Reverse mulligan** → at least one divergent holed-shot case *inside the full trip*, proving match vs skins/individual read correctly when everything else is also computing.
- **Do-overs** → breakfast ball / mulligan reflected in the counted score.
- **Shortened event** → run the same fixture as "Sunday didn't finish" and assert cup/title fall back to Saturday correctly.
- **Allowance** → the suite at 1.0; plus the isolated 0.9 case from Part D.

Organize it so a failure points clearly at which rule broke. This suite *is* the regression net for the rest of the build — every later change runs against it.

## Scope — Part F: The audit artifact (for Chris's hand-check)

The M2 gate is not just "tests pass" — it's **Chris hand-auditing a simulated trip.** Make that possible:
- A script or test output that prints the full simulated trip's results in human-readable form: final standings with points, the cup winner, Sunday pairings, each player's individual net and daily lows, skins results per round (who won which holes, carryovers), and the reverse-mulligan divergence shown explicitly (match score vs real score on that hole).
- Chris runs it, takes the printed scores, and checks the math by hand against the engine's output. When his hand math matches the engine on standings, skins, and the individual race, **M2 is met.**

---

## Verification (the M2 gate)

1. `npx vitest` green — all prior tests plus the full-trip suite and every Part E assertion.
2. `/engine` still imports nothing framework/Supabase.
3. No regression: M1 scorecard still works; Brief 2 & 4 tests still green.
4. The audit artifact (Part F) runs and prints a full, readable simulated-trip result.
5. **Chris hand-audits that output** — standings, skins, individual race all match his manual math. This human check is the actual gate; the green suite is necessary but not sufficient.

## After M2

The entire scoring engine is complete and proven. The build shifts to **M3 — live multiplayer + admin + events**: realtime across devices, the admin panel (teams/captains/matchups/indexes/course setups/corrections/toggles), blind duo submissions, skins opt-in UI, the Challenge Ledger, schedule, champions wall. **Two must-do-before-M3 items are already flagged** (carry them into the M3 brief): revoke the interim anon-write policies on `hole_scores` (add real auth), and add the `unique(team_id, round_id)` constraint on `reverse_mulligans` before any RM-writing UI ships.

## Close-out

Session addendum (shipped / commits / deviations / open issues / **the audit-artifact command** so Chris can re-run it), to the Desktop project folder and `/docs`. If the full-trip assembly surfaced any spec ambiguity, note it — M2 is the moment to catch it, before real data and real money.
