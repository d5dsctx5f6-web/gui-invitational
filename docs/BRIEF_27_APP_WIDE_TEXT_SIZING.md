# BRIEF 27 — APP-WIDE TEXT SIZING (A REAL SHARED SCALE)

**Project:** The GUI Invitational app · **Type:** correctness/consistency fix, punch-list item · **Issued:** Jul 26, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 26 shipped (timezone fix + scorecard-only text sizing).
**Gate:** every player-facing screen — not just the scorecard — uses comfortably legible text (phone, sunlight, one-handed, per PRODUCT_SPEC §4), and it's driven by one shared scale so a future new screen inherits good sizing automatically instead of needing its own fix.

---

## Context (read once)

Brief 26 fixed text sizing on the scorecard specifically, and correctly stayed scoped there because it found **no central font-size scale exists anywhere in the app** — every screen sizes its own text independently. Chris now wants this applied app-wide, not just the scorecard. Rather than manually re-bump sizes on five more screens one at a time (repeating Brief 26's approach five more times, and leaving the same gap for the *next* new screen), this brief establishes an actual shared scale so the fix propagates automatically and permanently.

Grounding: `PRODUCT_SPEC.md` §4 (the standing "phone in sunlight, one-handed" principle this scale exists to serve), `SESSION_ADDENDUM_BRIEF26.md` (the specific sizes Brief 26 landed on for the scorecard — chips 8px→11px, hole metadata 11px→13px — useful as a reference baseline, not necessarily the final word), `gui_invitational_mockup.html` (the original design reference — check what type scale it implies, if any, for consistency with the original visual intent).

---

## Scope — Part A: Establish a real shared scale

- Define a small set of named text sizes as CSS custom properties (or the equivalent central mechanism already used elsewhere in this codebase — check for an existing pattern before inventing a new one) — something like: a small/secondary-label size, a body/primary size, and a large/emphasis size (for big numbers, headlines). Keep it to a handful of tiers, matching how screens in this app actually use text (metadata labels, primary content, big emphasis figures) — don't over-engineer a large granular scale nobody needs.
- Size each tier generously enough to satisfy "phone in sunlight, one-handed" — Brief 26's scorecard sizes (11px/13px minimums) are a reasonable floor to start from, but use judgment; err toward readable over compact.

## Scope — Part B: Migrate the scorecard onto the shared scale

- Brief 26 just hand-fixed specific pixel values on the scorecard. Migrate those onto the new shared tokens from Part A rather than leaving them as scorecard-only magic numbers — so the scorecard is now *using* the system, not coincidentally similar to it. Confirm no visual regression from what Brief 26 just fixed.

## Scope — Part C: Apply the scale everywhere else

- Roll the shared scale out across every other player-facing screen: `/duos`, `/money`, `/leaderboard`, `/rulebook`, `/schedule`. Replace one-off small text sizes with the shared tokens.
- `/admin` is lower priority (Chris-only, not the "sunlight/one-handed" player bar) but shouldn't have illegibly tiny text either — apply the same scale where practical; use judgment on how much of admin's denser layouts (e.g., Corrections' drill-down, Rounds & Matchups cards) can absorb larger text without breaking the layout, and note any places where a size had to stay smaller for that reason.

## Scope — Part D: Make it stick for future screens

- Confirm the shared scale is set up in a way a future new screen would naturally reach for (e.g., documented/obvious tokens, not something a future session would have to know to go find). A brief note in `/docs` or a code comment pointing future sessions at the scale is enough — don't over-build tooling for a one-person project.

---

## Verification

1. Shared scale exists as a small number of named tiers, not scattered one-off pixel values.
2. Scorecard migrated onto it with no visual regression from Brief 26.
3. Every other player-facing screen (`/duos`, `/money`, `/leaderboard`, `/rulebook`, `/schedule`) uses the shared scale, verified on a real mobile viewport — spot-check that small/secondary text is now comfortably readable, not just technically bigger by a pixel or two.
4. Admin reviewed for the same standard where layout allows; any necessary exceptions noted.
5. No regression: all engine tests still green (display-only change); no layout breakage from larger text pushing content awkwardly — check a couple of the denser screens (Corrections, Rounds & Matchups) specifically.

## Close-out

Session addendum (shipped / commits / deviations / open issues — especially any admin layout exceptions and where the scale/tokens live for future reference), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` — closes the app-wide text sizing item fully (supersedes Brief 26's scorecard-only scope).
