# BRIEF 4 — ENGINE: SKINS, REVERSE MULLIGAN, INDIVIDUAL RACE

**Project:** The GUI Invitational app · **Milestone:** toward M2 (part 1 of 2) · **Issued:** Jul 21, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** M1 complete (engine core — handicap conversion, net scoring, F9/B9/18 match state — live and tested; scorecard writing raw `hole_scores` to Supabase).
**Gate:** not a demo milestone by itself — this adds three of the engine's derived layers as pure functions with focused test suites. Success = skins, reverse-mulligan two-score, and individual-race functions all computing correctly, all new tests green, no regression in the existing engine or scorecard.

---

## Context (read once)

M1 proved the match-play core end to end: raw scores in, live F9/B9/18 out, on a real phone. Brief 4 is the first of two briefs that complete the full scoring engine (the M2 gate). It builds the **money and individual layers**; Brief 5 builds standings, earned pairings, shortened-event, allowance wiring, and the full simulated-trip suite that gates M2.

**Why this split:** these three functions — skins, the reverse mulligan two-score rule, and the individual race — are the trickiest, most bug-prone logic in the app, and they're independent of standings. Building and testing them in isolation, before they're woven into team standings (Brief 5), keeps each one verifiable. The reverse mulligan especially (the highest-risk logic) deserves its own focused test pass.

Everything stays in the pure `/engine` module: `(events, courseSetups, config) → derived state`. No I/O, no framework imports, no Supabase client in `/engine`. The app already fetches rows and hands plain data to the engine; this brief extends what the engine computes from that data.

Grounding: `PRODUCT_SPEC.md` §2 (canonical), **`PRODUCT_SPEC_ADDENDUM_A.md`** (the just-resolved decisions — read it, it fixes allowance %, skins carryover, and tie handling), `ARCHITECTURE.md` §3–4, `TESTING_AND_HARDENING.md` (Layer 1 lists what the eventual suite must cover — this brief covers the skins/RM/individual slices of it).

**Decisions locked in Addendum A that this brief encodes:**
- Handicap allowance = **100%** (full) both formats. The engine's allowance hook stays; it's just set to 1.0. (Brief 5 wires the config knob formally; here, net = full-handicap net.)
- Skins = **gross, opt-in, paid nightly.** Each round is its own pool; no cross-round carry. Within a round, ties carry hole-to-hole.
- **No ties resolved in software.** If a true tie survives automatic criteria, surface a "chip-off required" state; never break it in code. (That mostly matters for Brief 5 standings, but the individual-race function here should also never fabricate a strict order through a tie — equal nets are equal.)

---

## Scope — Part A: Skins (gross, opt-in, paid nightly)

A pure function: given a round's hole scores, the skins entries (who opted in), and the course setup → the skins result for that round.

Rules (from SPEC §2 + Addendum A):
- **Gross** scores only — raw strokes, no handicap. (Skins ignore dots entirely; this is the one place net doesn't apply.)
- **Opt-in per round:** only players in `skins_entries` for that round are eligible. **Non-entrants are invisible** — their scores neither win a hole nor block/carry it. Compute skins purely over the entrant pool.
- **Lowest gross wins the hole outright.** A unique low among entrants wins. A tie for low → **no winner, pot carries to the next hole.**
- **Carryover chains:** consecutive tied holes stack; the next hole with a unique low winner takes all accumulated holes. Handle a chain that runs several holes and resolves later; handle a chain that never resolves (tied through 18 → those holes' skins are unclaimed/void for the round — return them clearly, don't crash).
- **Paid nightly:** this function computes one round in isolation. No Saturday→Sunday carry. (Money value per skin is `entrants × buy-in ÷ ...` presentation — but keep the engine output as *holes won per player* + carryover structure; the dollar rendering can live in the UI or a thin helper, since buy-in is admin config. Engine returns the truth: which player won which holes, and which holes carried/voided.)

Output shape: per hole → won-by (player id or "carried"/"void"); per player → list of holes won and count; the carryover state across the round. Count-agnostic: works for any number of entrants (2 to 16), including an entrant pool smaller than the field.

**Reverse-mulligan interaction (critical):** skins read the player's **real score** (`strokes`), never the match-only score. If a reverse mulligan diverged a hole (see Part B), the holed/real score is what counts for skins. Use `strokes`, not `coalesce(match_strokes, strokes)`, in the skins function. This is the two-score rule's payoff — test it explicitly (a player whose shot was reverse-mulliganed still wins the skin on the shot he actually holed).

## Scope — Part B: Reverse mulligan two-score rule

This is the highest-risk logic in the app. The reverse mulligan is a **team weapon** (one per team per round) that forces an opposing player to replay a shot — but a made shot stays made for money and the individual race. The data model already supports it: `hole_scores.match_strokes` (nullable) holds the match-only score when it diverges from the real `strokes`.

Build the engine logic that consumes reverse-mulligan events and applies the two-score rule correctly:

- **Two score sources, one per player-hole:**
  - **Match computations** (duo match state, F9/B9/18 — the Brief 2 engine) read **`coalesce(match_strokes, strokes)`**. When an RM diverged the hole, `match_strokes` is the replay result and the match sees it.
  - **Skins and the individual race** read **`strokes`** — the real score. A holed shot that got reverse-mulliganed still counts at its real value for money and individual.
- **When they diverge vs. when they don't:** most holes have `match_strokes = null` → both sources read `strokes`, no divergence. Divergence happens only when an RM forces a replay of a *holed* shot (or otherwise changes the match-relevant score while the real score stands). The engine must handle both: null (the common case) and diverged (the rare, high-stakes case).
- **Reverse-mulligan availability** is derived state the UI needs live in **both** of a team's foursomes: has this team used its one RM this round yet? Compute "RM available for team T in round R" from the `reverse_mulligans` events (absence = available, one event = burned). This is what the mockup shows as "in the holster" vs "burned."
- **Do NOT build** the RM *calling* UI or the scorekeeper flow in this brief (that's M3 multiplayer/admin). Build the engine logic that (a) exposes availability and (b) applies the two-score split correctly wherever scores are read. The scorecard's existing single-score entry is unaffected for now.

The verification bar here is the divergent-score path: a hand-built fixture where player X holes a shot (real score 3), the opposing team reverse-mulligans it, X's replay makes 5 → the **duo match** sees X at 5 on that hole, but **skins and individual** see X at 3. Both must be simultaneously true from the same data. Test this directly and thoroughly — it's the single most important test in the app.

## Scope — Part C: Individual net race

A pure function: across both competitive rounds → each player's cumulative individual net, running and final.

- **Net, full handicap** (allowance 1.0 per Addendum A): each player's net per hole = gross − strokes received (from the Brief 2 handicap/dots logic), summed across all holes played in both rounds.
- **Reads real scores** (`strokes`) — every shot counts once for the individual race, at its real value (RM-proof, per Part B).
- **Every shot counts twice** in the sense that the same real score feeds both the duo match (via its own source) and the individual race — but the individual function computes independently from raw scores, it doesn't read match state.
- **Daily low net:** identify the low net for each round (recognition only, no money — SPEC §2). Ties for daily low are just tied (multiple players can share it) — do not force a single winner.
- **Running totals:** the function should work mid-round (only some holes entered) without corrupting — a not-yet-played hole contributes nothing, exactly like the match core. Count-agnostic and absence-tolerant.
- **No tie-breaking here.** Equal cumulative nets are equal; the title tiebreaker ladder (Addendum A) is Brief 5's job and bottoms out in a chip-off, never a software decision. This function just reports the numbers and the standings order, marking genuine ties as ties.

## Scope — Part D: Tests (Vitest, gates this brief)

Extend the suite. At minimum:

**Skins:**
- Simple: unique low among entrants wins the hole.
- Non-entrant invisibility: a non-entrant posts the lowest gross → hole is won by the lowest *entrant*, non-entrant neither wins nor carries.
- Carryover chain: two+ consecutive ties, then a unique low takes all accumulated holes.
- Unresolved chain: tied through the end → those holes void/unclaimed, no crash.
- Small pool: only 3 of the field opted in → computes over just those 3.
- RM interaction: an entrant whose holed shot was reverse-mulliganed still wins the skin on his real score.

**Reverse mulligan two-score:**
- Null case: `match_strokes = null` everywhere → match and skins/individual read identical scores (no divergence).
- **Divergent case (the critical test):** X real 3 / match 5 on a hole → duo match sees 5, skins sees 3, individual sees 3. All from one dataset.
- Availability: no RM event for team T → available; one event → burned; reflected for both the team's matches.

**Individual race:**
- Cumulative net across two rounds correct for a hand-checked player.
- Daily low net identified; a shared low returns multiple players, not one.
- Mid-round (partial holes) produces valid running totals, no crash on missing holes.
- RM-proof: individual net uses real score, not match score.

Green suite = brief complete. These join the Brief 2 tests as the growing seed of the M2 full-trip suite.

---

## Verification

1. `npx vitest` green, including every case in Part D — especially the divergent reverse-mulligan test.
2. No regression: M1 scorecard still works, match-state and handicap tests still pass.
3. `/engine` still imports nothing framework/Supabase (isolation holds).
4. Skins reads `strokes`; match reads `coalesce(match_strokes, strokes)`; individual reads `strokes` — verify the three score sources are wired to the right consumers (this is the whole ballgame for correctness).

## Deferred to Brief 5 (the M2 gate — do NOT build here)

Team standings rollup (points → cup ordering) · earned Sunday pairings (1v2, 3v4 from Saturday standings) · the tiebreaker ladders + "chip-off required" surfacing · shortened-event resolution · formal allowance-% config knob · the full simulated-full-trip test suite (16 players, both rounds, all edges together). Brief 4's functions are inputs to that suite; Brief 5 assembles and gates it.

## Close-out

Session addendum (shipped / commits / deviations / open issues), to the Desktop project folder and `/docs`. Note any place the implementation revealed a spec ambiguity worth resolving before Brief 5 assembles the full suite.
