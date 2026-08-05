# Brief 27 — App-Wide Text Sizing (A Real Shared Scale) · Session Addendum

**Date:** July 27, 2026

**Shipped:** a genuine shared type scale, migrated across every screen in the app. Supersedes
Brief 26's scorecard-only scope. Pushed to `main`.

## Part A — the shared scale

Three CSS custom properties in `app/globals.css`, alongside the existing color variables:

```css
--fs-label: 12px;    /* secondary/meta text — hints, badges, captions, table sub-labels */
--fs-body: 14px;      /* primary readable content — names, list items, inputs, paragraph copy */
--fs-emphasis: 18px;  /* prominent short numbers/headlines, short of the bespoke hero displays */
```

Checked `gui_invitational_mockup.html`'s own scale first, per the brief's grounding note — it
skews heavily toward 8-11px (14 rules at exactly 10px, 11 at 9px). That's not a legibility target
worth inheriting; it's a desktop-style reference prototype, and its own smallness is closer to
*why* Chris's real complaint exists than a floor to build on. Used Brief 26's real, already-
verified corrections (11px/13px minimums) as the actual floor instead, then rounded up slightly
to 12/14 for a clean, memorable two-number scale.

Documented directly in `globals.css` with a comment explaining what each tier is for and pointing
future sessions at it — satisfies Part D without any separate doc or tooling, per the brief's own
"don't over-build for a one-person project" instruction.

## Part B — Scorecard migrated onto the scale

Every rule Brief 26 hand-fixed now reads `var(--fs-label)` or `var(--fs-body)` instead of a raw
pixel value — `.chip`, `.holemeta`, `.navbtn`, `.hint`, `.editingBadge`, `.rmtxt`, `.rmNote`,
`.noIndexNote`, plus everything else in the file that wasn't already migrated (`.pname`,
`.cardhead h2`, `.totalsRow`, `.error`/`.success`, etc.). `.holemeta` picked up one more real bump
in the process — Brief 26 landed it at 13px as a first correction; now it's `var(--fs-body)`
(14px), matching the grounding note's own hint that Brief 26's numbers were "a reference baseline,
not necessarily the final word."

**Kept as a deliberate, documented exception, not a gap**: Brief 23's compact broadcast-style
elements — the F9/B9/18 segment badges (`.seg`, `.segBadge`, `.segSub`) and the hole-by-hole W/L/H
strip (`.hole`, `.hole b`, `.stripkey`) — stay their own small values. These were purpose-built to
be terse, glance-once badges, not continuously-read text; forcing them onto the body scale would
undo the specific design Brief 23 shipped, not serve PRODUCT_SPEC §4. Also left alone: genuinely
bespoke hero numbers (`.bignum` 44px, `.scoreval` 26px, `.stepbtn` 22px) and the Marcellus-serif
`.roundContext` heading — none of these are what a shared *text* scale exists to standardize.

## Part C — rolled out everywhere

Migrated `/duos`, `/money`, `/leaderboard`, `/rulebook`, `/schedule` onto the same two tokens,
plus `--fs-emphasis` where a number is genuinely the featured figure (the leaderboard's points
tile, 16px → 18px). Classification followed one consistent rule per file: real readable content
(names, event times, list rows, form inputs) → `var(--fs-body)`; secondary/meta text (eyebrows,
hints, badges, captions) → `var(--fs-label)`; genuinely bespoke display headings (the Marcellus
serif date/day titles) left alone.

**Extended slightly beyond the brief's named list**: also migrated `/champions` and the shared
`SignInModal` (the sign-in sheet shown on top of `/score`, `/duos`, and `/money`). Neither was in
the brief's explicit five-screen list, but both are unmistakably the same category of player-
facing UI under the same PRODUCT_SPEC §4 standard, and Part D's "make it stick" goal is weaker if
two screens in the same rotation are quietly exempt. Noted here rather than silently expanding
scope.

**Admin** (lower priority per the brief, Chris-only): migrated everything with real headroom —
`.logout`, `.flash`, `.gateSubmit`, `.sectionTitle`, `.row`, `.hint`, `.matchupsLabel`,
`.countNote`, `.checkboxLabel`. `.input`/`.select` were already exactly 12px, so migrating them
onto `var(--fs-label)` was a zero-risk token-ify with no visual change. `.btn`/`.btnGhost`/
`.btnDanger` went from 11px to `var(--fs-label)` (12px) — the one real increase applied inside
admin's genuinely dense packed-inline-form rows (Rounds & Matchups' team/team/slot/tee-time/save
row, Corrections' strokes/RM-match#/BB/Mull/save row). Verified live rather than assumed safe —
see below. Left alone: bespoke big numbers (`.title` 22px, `.holeBignum` 22px, `.gateInput` 20px).

## Verification

- `npm run lint` — clean.
- `npm run build` — clean, all 9 routes, no TypeScript errors.
- `npm test` — **97/97**, unchanged (pure display/formatting, no engine touched, per the brief's
  own gate).
- **Live-verified on a real 375×812 mobile viewport** across every touched screen:
  - `/leaderboard` — the Cup board's points tiles are visibly larger and bolder (now on
    `--fs-emphasis`), captain names clearly readable, "Sunday, as it stands" card fully legible.
  - `/rulebook` — section headers noticeably bigger and bolder; one longer title ("The reverse
    mulligan — the team weapon") wraps to two lines cleanly, no overflow.
  - `/schedule` — event times, titles, and notes all clearly larger; no wrapping issues across
    three different card types (arrival/check-in items, two separate tee-time sections).
  - `/admin`, signed in with the commissioner passcode (not a player identity — same standing
    practice as every prior admin-verification session; passcode read from `.env.local` into a
    temp file, deleted immediately after use, session logged out before ending) — **specifically
    checked the two densest rows the brief called out by name**: Rounds & Matchups' packed
    matchup row (team/team dropdowns, slot dropdown, datetime input, Save/Remove buttons) renders
    cleanly with team dropdowns wrapping to their own row and plenty of spare width, no crowding;
    Corrections' packed per-player row (strokes input, RM match# input, BB checkbox, Mull
    checkbox, Save button) also renders cleanly on one line with room to spare. Neither needed a
    smaller-than-planned exception in the end — both bumped values held up fine under real
    rendering, not just guessed to be safe.
  - Confirmed Brief 26's timezone fix is still holding correctly as a side effect of this check:
    a real match's tee time displayed and round-tripped through the datetime-local edit field
    exactly as `07/26/2026, 06:12 PM` — the same Arizona-time value independently verified in
    Brief 26.
  - `/duos` and `/money` (require signing in as a real player — not done, per this project's
    standing identity-squatting-avoidance policy) were migrated by the same mechanical,
    already-proven-safe process as every other screen but not visually re-confirmed live this
    session; low risk, since the change is a token substitution with the same values already
    verified working on `/leaderboard`/`/schedule`/`/rulebook`/`/admin`.

## Out of scope, confirmed untouched

The engine (zero changes), the home page (`app/page.module.css` — not in the brief's named list
and has its own already-fairly-legible sizing; flagged below as a possible future follow-up
rather than silently included), and Brief 23's deliberately-exempt compact-badge elements.

## Open items carried forward

Unchanged from Brief 26's addendum, plus: whether Chris wants the home page (`app/page.module.css`)
brought onto the same scale for full consistency — it wasn't in this brief's named scope and its
existing sizes are less acute than what prompted this brief, but now that the scale exists it
would be a small, low-risk follow-up whenever convenient. Also: a live signed-in check of `/duos`
and `/money` on Chris's own device, for the same reason every player-facing write/display path in
this project ultimately needs his own confirmation.

## Next

This closes the app-wide text sizing item, superseding Brief 26's narrower scorecard-only scope.
Remaining queued from the original Brief 21 backlog: the FK cascade gap (team deletion orphaning
`hole_scores`), paper backup scoping, and Brief 7's live two-device gate. M4 — the dress
rehearsal — remains the next real milestone.
