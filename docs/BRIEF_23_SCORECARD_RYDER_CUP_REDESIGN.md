# BRIEF 23 — SCORECARD REDESIGN: RYDER CUP STYLE

**Project:** The GUI Invitational app · **Type:** UI redesign, punch-list item · **Issued:** Jul 26, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 22 shipped (skins cutoff timing fix).
**Gate:** the active entry screen is decluttered (Running Totals and the full hole-by-hole breakdown tucked into a collapsible "Scorecard" view, not in the way while entering scores); a compact, always-visible up/down indicator lets a player glance and know who's up without opening anything; browsing to an already-posted hole shows a prominent banner naming who won it.

---

## Context (read once)

Chris: "the scoring screen looks busy... I want a view I can toggle into of who won what hole, point change, etc, traditional Ryder Cup style... I don't want it in people's face while capturing a score." Three related asks:

1. A collapsible **"Scorecard"** view holding the hole-by-hole win/loss/halve breakdown and the existing Running Totals card — hidden by default during active entry, revealed on demand.
2. A **persistent, compact** up/down indicator at the top of the entry screen (not hidden in the dropdown) — Ryder Cup style, glanceable, so "who's up and by how much" is visible without opening anything.
3. A **prominent banner** naming the hole's winner when browsing to an already-posted hole — same spirit/slot as the existing "ALREADY POSTED — EDITING" badge, but for the result itself, more prominent, so scrolling hole-to-hole tells the story of the match.

**Good news: the visual design for #1 already exists.** `gui_invitational_mockup.html`'s Matches screen has the exact pattern — a `.holes` grid, one tile per hole, colored/labeled `W`/`L`/`H` (won/lost/halved) from the viewing side's perspective. This was designed before any code existed and never got built into the real Scorecard. Reuse it directly rather than inventing a new visual language.

Grounding: `gui_invitational_mockup.html` (the `.holes`/`.hole.W/.L/.H` pattern, and the `.state`/`.segs` F9/B9/18 tile pattern — both directly reusable), the current `Scorecard.tsx` (read what it does today before changing it — the F9/B9/18 status tiles already exist at the top; this brief likely simplifies/complements them, doesn't necessarily replace them wholesale — use judgment once you see the current layout).

---

## Scope — Part A: Diagnose what data already exists

- Confirm whether the match-state engine function (Brief 2) already computes a per-hole win/loss/halve result internally (it almost certainly must, as an intermediate step to determine F9/B9/18 segment outcomes) — or whether that per-hole breakdown needs to be additionally exposed/returned, not newly computed. This should be a data-exposure change at most, not new match logic — the underlying computation should already be correct and tested since Brief 2/5.

## Scope — Part B: The collapsible "Scorecard" view

- Add a clearly labeled toggle/dropdown (e.g., "Scorecard") on the entry screen. Collapsed by default.
- Expanded, it shows:
  - The hole-by-hole result strip, Ryder Cup style — one tile per hole played so far, W/L/H from the signed-in player's duo's perspective, mirroring the mockup's `.holes` pattern exactly (color, labeling).
  - The existing **Running Totals** card, moved here from its current always-visible position.
- Collapsed (default) state: neither of these is visible — the entry screen is just hole entry + the new compact indicator (Part C).

## Scope — Part C: Persistent compact up/down indicator

- A small, always-visible (never hidden behind the toggle) summary at the top of the entry screen — F9/B9/18 status, but more compact/glanceable than a wall of text. Ryder Cup broadcast style: think directional arrows or a simple colored badge conveying "who's up, by how much" per segment at a single glance.
- This is distinct from Part B's full breakdown — it's the always-on ambient summary; Part B is the on-demand deep dive.
- Use judgment on exact visual treatment (the brief intentionally doesn't over-specify — "up/down arrows or something like that" per Chris) but the functional bar is: a player glances at the top of the screen and immediately knows who's up, without tapping anything.

## Scope — Part D: Prominent hole-winner banner

- When viewing an **already-posted** hole (the existing "ALREADY POSTED — EDITING" state), add a clear, prominent banner naming the result: "Team [X] won hole [N]" / "Hole [N] halved" / etc. — from the signed-in player's duo's perspective, consistent with Part B's strip.
- More visually prominent than the existing "already posted" badge, per Chris's explicit ask — this is the headline information on that screen, not a footnote.
- Only applies to posted holes with a determinable result — a hole with no score yet shows nothing (there's no winner to announce).

---

## Verification

1. Confirm Part A's diagnosis before building — is per-hole win/loss/halve data already computed and just needs exposing, or does it need new logic? Report either way.
2. Entry screen with the Scorecard view collapsed: no Running Totals, no hole-by-hole strip cluttering the view — just hole entry and the compact indicator.
3. Expand the Scorecard view: hole-by-hole strip renders correctly (spot-check against known match results from real/test data), Running Totals present and correct.
4. Compact indicator at the top correctly reflects current F9/B9/18 status at a glance, without expanding anything.
5. Navigate to an already-posted hole: prominent banner correctly names the winner (or halved), consistent with the hole-by-hole strip's own record of that same hole.
6. No regression: hole entry, do-over toggles, RM calling, and posting all function exactly as before; all engine tests still green (no engine changes expected beyond possibly exposing existing computed data per Part A).

## Close-out

Session addendum (shipped / commits / deviations / open issues — especially Part A's findings and any visual-treatment choices made under judgment in Part C), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` — closes the scorecard redesign item from the punch list.
