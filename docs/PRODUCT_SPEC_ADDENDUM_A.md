# PRODUCT SPEC — ADDENDUM A: Resolved Open Items (§5)

**Date:** July 21, 2026 · **Resolves:** PRODUCT_SPEC §5 open items, ahead of the M2 engine.
**Status:** decided by Chris; encoded as engine config defaults (all adjustable without code changes where noted).

These decisions close the open items that the full scoring engine (Briefs 4–5) needs. They fold into PRODUCT_SPEC §2; recorded here as a dated addendum so the change is traceable.

---

## 1. Handicap allowance per format
**Decision: 100% (full handicap) for both shamble and four-ball.**
Rationale: 16 friends, not a stranger tournament; the cup is team match play across three segments, which already dampens any single outlier round; the design ethos is zero math in a player's head. Full handicap is the simplest, most forgiving choice. Adjustable to 90% (or per-format values) via the allowance hook already built into the engine (Brief 2) — a one-number change, no migration.

## 2. Skins carryover
**Decision: paid nightly.** Each competitive round is its own gross-skins pool, settled that night. Nothing carries Saturday → Sunday. Simplifies the engine: skins resolve within a single round, no cross-round carry state. (Within a round, ties still carry hole-to-hole per the existing rule; "paid nightly" only means the *round's* pool doesn't roll into the next round.)

## 3. Tiebreaker ladders
**No ties, ever — every ladder bottoms out in a chip-off.** Automatic criteria resolve the vast majority of cases; if standings are still dead even after them, the engine flags "chip-off required" and the commissioner runs it on the practice green and records the winner in admin. No co-champions, no coin flip — the trip ends with wedges, not a spreadsheet.

**The Cup (team):**
1. Most cumulative points (24 max).
2. Head-to-head result, if the tied teams played each other.
3. Total individual holes won across the trip.
4. **Chip-off** — the tied teams chip for the cup; commissioner records the result.

**Individual net title:**
1. Lowest cumulative net across both competitive rounds.
2. Better Sunday (four-ball round) net.
3. Better back-9 net on Sunday.
4. **Chip-off** — the tied players chip for the title.

**Saturday seeding → Sunday pairings (must produce strict order):**
1. Points.
2. Head-to-head.
3. Total holes won.
4. **Chip-off** (or commissioner's call if impractical the night before) — recorded in admin to set the pairings.

Engine responsibility: compute standings, apply the automatic criteria, and if a tie survives, surface a clear "chip-off required" state for the commissioner to resolve — never attempt to break a true tie in software. The chip-off outcome is entered as an admin decision.

---

**Remaining §5 items still open (lower urgency, not blocking Brief 4):**
- Challenge Ledger edges (acceptance window, void conditions, disputes) — resolve before M3 admin panel.
- Reverse mulligan edges (exact timing window, non-holed-shot cases beyond the two-score rule) — the two-score rule itself is fully specified and built in Brief 4; these are conduct edges for the Rulebook.
