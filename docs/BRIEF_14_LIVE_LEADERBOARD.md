# BRIEF 14 — THE LIVE LEADERBOARD

**Project:** The GUI Invitational app · **Type:** new core screen, punch-list item · **Issued:** Jul 23, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 13 shipped (duo submissions fixed, admin duo control live).
**Gate:** from the home page, one tap reaches a live standings view showing the Cup race (team points) and the individual net race, both correct against the engine, both updating in realtime as scores post — no manual refresh.

---

## Context (read once)

This is a genuine gap, not a polish item: **there has never been a standings/leaderboard screen in the real app.** The engine has computed team standings and the individual net race correctly since Brief 5 (`rankTeams()`, `computeIndividualRace()`, both proven in the M2 audit) — but no brief ever built a screen to display them. `gui_invitational_mockup.html`'s "Cup" screen (`scr-cup`) has always shown this as the app's primary view; the real build just never got there. Chris flagged it directly: "an easily accessible live leaderboard."

This should be one of the most prominent screens in the app — arguably *the* screen, since "who's winning right now" is the single most-checked piece of information across the whole weekend.

Grounding: `gui_invitational_mockup.html` `scr-cup` and `scr-ind` sections (the visual/structural reference — slotboard team standings, a Sunday-pairings-as-it-stands card, an individual net race board), `PRODUCT_SPEC_ADDENDUM_A.md` (the tiebreaker ladders and chip-off surfacing — the leaderboard must render these states correctly, not crash or guess), `BRIEF_5_ENGINE_M2_SUITE.md` (`rankTeams()`, `computeEarnedPairings()`, individual race — read what these functions actually return before building the UI around them).

---

## Scope — Part A: The Cup — team standings

- A screen (or the primary section of one) showing team standings ordered by points, live: team name, cumulative points (out of 24), and enough breakdown to explain the order (holes won, head-to-head note) — per the mockup's slotboard pattern.
- **Must render every state `rankTeams()` can return correctly:**
  - A clean, decided order (the common case).
  - A **`chipOffRequired`** result — two or more teams still tied after all automatic criteria. This must display clearly (e.g., "Chip-off required: Team X vs Team Y") — never silently pick a winner, never crash, never show a misleading single order when the engine says it's unresolved.
  - Partial-trip state (only Saturday complete, or mid-round) — points reflect whatever's actually been played; this should fall out naturally from `rankTeams()` reading current match state, but confirm it renders sensibly with a partial data set, not just the full-trip fixture.
- Pull from the engine, don't recompute in the UI — same rule as every prior screen.

## Scope — Part B: Individual net race

- A second section or a tab/toggle (per the mockup's `scr-ind`, currently reachable via "More" — decide whether it stays a sub-view of the leaderboard or gets its own toggle within this screen; either is fine, prioritize clarity) showing the individual net race: rank, player, cumulative net, low-to-high (lower is better).
- Daily low net recognition (per SPEC — no money, just a marker/badge) for each round played so far.
- Same correctness bar: partial-trip data renders sensibly; ties display as ties (per Brief 4/5, no fabricated ordering through a genuine tie at this level — that's a title-tiebreaker concern for chip-off, not for the running leaderboard display, which should just show equal numbers as equal).

## Scope — Part C: Optional — Sunday pairings preview

- If Saturday's standings are far enough along to compute earned pairings (`computeEarnedPairings()` from Brief 5), consider surfacing "Sunday, as it stands" per the mockup — projected 1v2 / 3v4 matchups. This is a nice-to-have that uses an already-built function; include if it's a clean addition, skip without guilt if it complicates scope. Note the decision either way in the addendum.

## Scope — Part D: Realtime + placement

- Wire the same `useRealtimeRefetch` pattern already used on `/score`, `/duos`, `/money` (Brief 7) — a posted hole should update the leaderboard within seconds, no manual refresh.
- **Home page placement:** per Brief 9's Part C precedent (big buttons, near the top), give this a prominent, easily-reachable entry point — this is explicitly what Chris asked for ("easily accessible"). Discuss/decide whether this becomes the single most prominent button (arguably more central than "Score a round" for anyone not currently scoring) — use judgment, but don't bury it below Duo Submissions / Money / Schedule the way it would be if just added as a fifth equal button. It's more accurate to treat it as a headline feature.

---

## Verification

1. Leaderboard reachable in one tap from home, sized/placed prominently per Brief 9's button standard.
2. Team standings render correctly against the current real data (spot-check against what's actually in the demo/test rounds); a `chipOffRequired` case (construct one via test/demo data if the current live data doesn't have one) displays clearly, doesn't crash, doesn't fabricate an order.
3. Individual race renders correctly, low-to-high, with daily lows marked.
4. Post a hole on the scorecard (or make an admin correction), confirm the leaderboard updates within seconds with no manual refresh.
5. No regression: all existing screens and the engine's 84 tests still pass; `/engine` isolation intact.

## Close-out

Session addendum (shipped / commits / deviations / open issues — especially the Part C pairings-preview decision and Part B's tab-vs-separate-screen choice), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` — closes the leaderboard item from the punch list.
