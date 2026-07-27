# BRIEF 20 — ADMIN CORRECTIONS REORGANIZATION

**Project:** The GUI Invitational app · **Type:** admin UX cleanup, punch-list item · **Issued:** Jul 26, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 19 shipped (leaderboard Net/Gross toggle).
**Gate:** Chris can find and correct any specific player's score on any specific hole without scrolling a flat wall of rows — drill-down by round, then match, then hole, showing only the handful of rows relevant at each step.

---

## Context (read once)

Chris flagged this directly: admin's Corrections section is currently a flat list of every player/hole/round's score, all at once — "so overwhelming." This is the tool he'll reach for constantly, live, under pressure during real scoring and especially during M4's dress rehearsal — a wall of undifferentiated rows is the worst possible shape for that moment.

This is purely a reorganization, same spirit as Brief 15 Part D (which successfully turned Rounds & Matchups from a flat list into per-round cards). No corrections capability should be removed — every edit that's currently possible must remain possible, just reachable through a sane drill-down instead of one giant scroll.

Grounding: `BRIEF_15_STALE_LEADERBOARD_DATA_FIX.md` Part D (the per-round card pattern already established — reuse it, don't reinvent), the live scorecard's own hole-by-hole layout (`Scorecard.tsx` — the "Hole N Scores" card showing exactly the 4 relevant players for that hole is the shape to mirror, since Chris already knows how to read it).

---

## Scope: Round → Match → Hole drill-down

Reorganize Corrections into three nested levels, showing only what's relevant at each step:

- **Level 1 — Round.** Reuse the existing per-round card pattern from Brief 15 (course + format + date header). Corrections live inside the relevant round's card, or a dedicated Corrections view scoped by a round selector — whichever integrates more cleanly with the current screen structure; use judgment.
- **Level 2 — Match.** Within a round, list its matches clearly (e.g., "Team Deilso v Team Jones — Slot A") — pick one to drill into. Four matches per round max, so this level should never be long.
- **Level 3 — Hole.** Within a match, show one hole at a time with its four players' scores editable inline — mirroring the scorecard's own "Hole N Scores" card exactly (same layout, same fields: gross strokes, do-over flags). Navigate between holes the same way the scorecard does (whatever left/right or dropdown pattern already exists there — reuse it, don't invent a new one).
- At the hole level, saving an edit should behave exactly as corrections do today (write to `hole_scores`, ripple to derived state everywhere) — this brief changes navigation/grouping only, not the underlying write behavior.

## Non-goals

Don't add new correction capabilities beyond what exists today (that's out of scope here). Don't touch the Rounds & Matchups card layout itself (already fixed, Brief 15). Don't change how corrections propagate to derived state (already correct, proven since Brief 6).

---

## Verification

1. From admin, reach a specific player's specific hole score in a specific match/round in three clear steps (round → match → hole) — no flat scroll required.
2. Edit a score at the hole level; confirm it saves and ripples to the scorecard/leaderboard exactly as before (no regression to the correction mechanism itself).
3. Confirm every hole/player/round that was previously reachable in the flat list is still reachable through the new drill-down — nothing lost, just reorganized.
4. No regression: Rounds & Matchups cards, engine tests, and every other admin section unaffected.

## Close-out

Short session addendum, to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` — closes the Corrections item from the punch list.
