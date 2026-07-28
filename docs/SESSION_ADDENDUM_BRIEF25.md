# Brief 25 — The In-App Rulebook Screen · Session Addendum

**Date:** July 27, 2026

**Shipped:** a new public screen, `/rulebook`, pure content/UI — no engine or data involvement.
Pushed to `main`.

## What changed

`/rulebook` — reachable from the home page's nav row, no sign-in required (same tier as
`/schedule`/`/champions`/`/leaderboard`). Nine collapsible sections, one per Part B header,
collapsed by default so a player can jump straight to whatever he's confused about rather than
scroll a wall of text — the same "tap to reveal" interaction language Brief 23 established for
the Scorecard's own collapsible view, applied here as a reusable list of independently-toggleable
sections rather than one single toggle.

No data fetching at all — the copy is fixed text, so `app/rulebook/page.tsx` is a plain client
component (`"use client"`, needed only for the open/closed `Set<string>` state), not a server
component with a Supabase call. This is why it shows as a **static** route (`○`) in the build
output rather than dynamic (`ƒ`) like every other screen in this app.

## Part C — accuracy cross-check (two discrepancies found)

Cross-checked every rule in Part B's copy against `PRODUCT_SPEC.md` §2, `GUI_INVITATIONAL_RULEBOOK.md`
v1.6, and `PRODUCT_SPEC_ADDENDUM_A.md`. Everything else matched cleanly — two things worth Chris's
attention:

**1. Fixed a real inaccuracy in the provided copy (shipped as a small, deliberate edit, not
verbatim).** The "How ties get broken" section's original text read: *"If the automatic
tiebreakers (points, head-to-head, holes won) still leave it dead even — for the Cup, the
individual title, or Sunday's pairings — it comes down to a chip-off."* That parenthetical list is
only accurate for **two** of the three ladders. Per `PRODUCT_SPEC_ADDENDUM_A.md` §3:
- The Cup and Sunday's pairings seeding *do* use points → head-to-head → holes won → chip-off.
- The **individual net title** uses a completely different ladder: lowest cumulative net → better
  Sunday (four-ball) net → better Sunday back-9 net → chip-off. Points, head-to-head, and holes
  won don't even apply to individual net scoring.

Stating "(points, head-to-head, holes won)" as if it covered all three is a factual error exactly
in the spirit of what the brief itself flagged as the real risk here — "getting the wording
slightly wrong here risks a real argument on the course." Rather than ship a wrong claim
verbatim, I dropped the inaccurate parenthetical and left the sentence otherwise unchanged: *"If
the automatic tiebreakers still leave it dead even… it comes down to a chip-off."* Still true for
all three cases, just no longer over-specifying a list that doesn't universally apply. Flagged
here per the brief's own instruction to surface rather than silently resolve — happy to add the
individual title's specific ladder as its own line if Chris wants that level of detail on-screen.

**2. Found, but did not touch: `GUI_INVITATIONAL_RULEBOOK.md` v1.6 (the internal doc) is itself
stale relative to the skins carryover policy reversal.** `PRODUCT_SPEC_ADDENDUM_A.md` §2 was
revised July 26, 2026 to make unresolved skins carry forward into the next round's pool
(Brief 21), explicitly superseding the original "paid nightly, nothing carries" call. The internal
`GUI_INVITATIONAL_RULEBOOK.md` §6, still at v1.6, wasn't updated to reflect this — it still just
says "carryovers on ties" with no mention of the cross-round rollover. This doesn't affect the app
(the new `/rulebook` screen correctly uses the newer, authoritative Addendum A wording, and so does
`/money`'s own engine behavior since Brief 21), but the internal reference doc is now out of sync
with the rule it's supposed to document. Worth a version bump to v1.7 whenever convenient — not
blocking, not touched this session.

Everything else in Part B's copy was cross-checked and found accurate: the format/points/earned-
pairings structure, both format descriptions, the handicap philosophy, do-overs, the reverse
mulligan's two-score exception (word-for-word match to Rulebook §5's "made shot stays made"
language), the individual race, and the Challenge Ledger description.

## Verification

- `npm run lint` — clean.
- `npm run build` — clean, all 9 routes (new `/rulebook` correctly renders as a static route),
  no TypeScript errors.
- `npm test` — **97/97**, unchanged (no engine touched at all — pure content/UI addition, exactly
  as the brief's own gate describes).
- **Live-verified on a real mobile viewport (375×812)**: all 9 sections present, correctly
  collapsed by default, readable one-handed with no horizontal scroll. Spot-checked the three
  most nuanced/recently-changed rules per the brief's own verification list — reverse mulligan's
  two-score exception, skins cross-round carryover, and the (corrected) chip-off-not-ties policy —
  all expand correctly and match the intended copy exactly. Nav link from the home page confirmed
  present and correctly routes to `/rulebook`.

## Out of scope, confirmed untouched

The engine, every other screen, and the internal `GUI_INVITATIONAL_RULEBOOK.md`/`PRODUCT_SPEC.md`
docs themselves (read for cross-checking only, not edited).

## Open items carried forward

Unchanged from Brief 24's addendum, plus the two items above: whether Chris wants the individual
title's own tiebreaker ladder spelled out explicitly in the app copy, and whether to bump
`GUI_INVITATIONAL_RULEBOOK.md` to v1.7 to reflect the skins carryover reversal.

## Next

This closes the "in-app Rulebook screen" item from Brief 21's original backlog note. Remaining
queued items: timezone fix (tee times in `America/Phoenix`), text sizing pass, the FK cascade gap,
paper backup scoping, and Brief 7's live two-device gate. M4 — the dress rehearsal — remains the
next real milestone.
