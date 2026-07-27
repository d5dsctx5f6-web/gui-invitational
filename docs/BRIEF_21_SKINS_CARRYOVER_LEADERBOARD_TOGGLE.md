# BRIEF 21 — SKINS CROSS-ROUND CARRYOVER + LEADERBOARD TOGGLE FIX

**Project:** The GUI Invitational app · **Type:** engine change + UI bug fix · **Issued:** Jul 26, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 20 shipped (Corrections reorganization).
**Gate:** an unresolved Saturday skins pool correctly carries its unclaimed value into Sunday's pool; toggling the leaderboard's Individual Race to Gross makes gross-to-par the prominent displayed number (net becomes secondary), and vice versa for Net — with sort order, which was already correct, unaffected.

---

## Context (read once)

Two unrelated fixes bundled because both landed the same session.

**Part A is a real decision reversal, not just an engine tweak.** Chris originally decided skins are "paid nightly" — each round fully independent (`PRODUCT_SPEC_ADDENDUM_A.md` §2, original text). He's now reversed that: if a round ends with skins still unclaimed (a carryover chain that never resolved), the unresolved value should **roll forward into the next round's pool** rather than voiding — a standard, commonly-used skins house rule, chosen specifically because it fully resolves every dollar for same-day cash settle-up. `PRODUCT_SPEC_ADDENDUM_A.md` has already been updated to reflect this — read the revised §2 before starting. **This requires real engine work**: `computeSkins()` (Brief 4) was explicitly built assuming full round independence, with no cross-round state at all.

**Part B is a display bug, not a math bug**, confirmed by Chris's own screenshots: the Net/Gross toggle (Brief 19) correctly re-sorts the player list, but the large, prominent colored number never actually changes — it always shows net-to-par, even in Gross mode, with gross relegated to small secondary text regardless of toggle state. The fix is display-only.

Grounding: `PRODUCT_SPEC_ADDENDUM_A.md` §2 (revised — the source of truth for Part A), `BRIEF_4_ENGINE_SKINS_RM_INDIVIDUAL.md` (the original `computeSkins()` spec — read what it currently assumes about round independence before changing it), `BRIEF_19...` (the toggle this fixes — read what it built before modifying it).

---

## Scope — Part A: Skins cross-round carryover (engine change)

- With exactly two competitive rounds (per fixed Rulebook structure — shamble Saturday, four-ball Sunday), this only ever matters once: determine whether Saturday's skins pool ended with an unresolved carryover chain (holes tied all the way through 18, no unique winner ever found for that accumulated stack).
- If so, that **unresolved hole-count** (not a dollar figure — buy-ins can differ per round via `rounds.skins_buy_in`, so carry the count of unresolved holes forward, and value them using Sunday's own buy-in/entrant pool when they're eventually claimed) becomes additional value riding on Sunday's carryover state *before* Sunday's hole 1 is even played. If Sunday's hole 1 has a unique low-score winner among entrants, they win Saturday's carried holes' value plus hole 1's own value, combined.
- Extend `computeSkins()` (or add a small wrapper/parameter) to accept an optional "carry-in" from a prior round's result. Keep the core within-round logic unchanged — this is additive, not a rewrite.
- **Sunday's own leftover, if any, at the end of the trip:** out of scope to auto-resolve (there's no "next round" to carry into) — leave it as a clearly-surfaced unresolved amount for Chris to handle manually. Don't invent a resolution mechanism for this edge case.
- Write dedicated tests for the cross-round case: a Saturday round with a genuine unresolved tail, confirm it correctly rides into Sunday's pool and gets claimed by Sunday's first legitimate winner; confirm a Saturday round that resolves cleanly (no carry-in) leaves Sunday unaffected, matching current behavior exactly.

## Scope — Part B: Leaderboard toggle — fix which number is prominent

- In the Individual Race view, the large/primary colored badge must reflect the **currently selected toggle state**: Net mode → net-to-par prominent, gross-to-par secondary (current, correct behavior for Net). Gross mode → **gross-to-par prominent, net-to-par secondary** (currently broken — always shows net regardless of toggle).
- Sort order is already correct in both modes (confirmed against Chris's screenshots) — do not change the sorting logic, only which value is displayed as the primary badge vs. secondary text.
- The ◆ daily-low-net badge should remain net-based in both views (per Brief 19's existing design) — confirm this doesn't get accidentally changed while fixing the primary-number binding.

---

## Verification

1. Construct or use a real/test scenario where Saturday's skins pool ends unresolved; confirm Sunday's pool correctly carries the unclaimed hole-count and a Sunday winner claims the combined value.
2. Confirm a Saturday round that resolves cleanly leaves Sunday's skins completely unaffected (no false carry-in).
3. Toggle the leaderboard to Gross — confirm the large badge shows gross-to-par (not net), sort order still correct, net shown as secondary text.
4. Toggle back to Net — confirm original behavior fully restored.
5. No regression: within-round carryover chains (already correct since Brief 4) unaffected; all engine tests green including new cross-round-carry tests; Brief 20's Corrections reorganization and everything else unaffected.

## Close-out

Session addendum (shipped / commits / deviations / open issues), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md`. Note explicitly that this is a documented policy reversal (Addendum A §2) so it's traceable later.

---

## Not in this brief — the rest of tonight's backlog, queued for follow-up briefs

Chris raised a substantial additional list this session, deliberately not crammed into this brief:
- **Scorecard redesign, Ryder Cup style** — confirmed direction; the original `gui_invitational_mockup.html` already designed the W/L/H hole-by-hole strip and up/down segment banners, they were just never built into the real Scorecard. Needs its own brief: a collapsible "Scorecard" view (hole-by-hole result strip + Running Totals) tucked out of the way during entry, a persistent small up/down indicator, and a more prominent "Team X won hole N" banner.
- **In-app player-facing Rulebook screen** — comprehensive but concise, distinct from the internal markdown docs.
- **Sunday pairings preview** on the leaderboard — newly unblocked (per Brief 17's note that `rounds.format` already distinguishes Saturday/Sunday), not yet built.
- **Money screen round-selector prominence.**
- **Running ledger — color-code/differentiate Challenge Ledger winnings from skins winnings.**
- **Timezone fix** — tee times should render in `America/Phoenix` (no DST in Arizona), not browser-local time.
- **Text sizing pass** — too small across the scorecard.
- Still carried from before: the FK cascade gap (team deletion orphaning `hole_scores`), the paper backup scoping conversation, the Brief 7 live two-device gate.

These will be grouped into 2–3 follow-up briefs next session rather than attempted in one giant pass.
