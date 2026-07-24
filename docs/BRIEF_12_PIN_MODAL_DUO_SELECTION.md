# BRIEF 12 — UI FIXES: PIN MODAL + DUO A/B SELECTION

**Project:** The GUI Invitational app · **Type:** UI/interaction fixes, punch-list items · **Issued:** Jul 23, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 11 shipped (RM visibility confirmed correct, no fix needed).
**Gate:** signing in feels like a quick popup, not a page trip; assigning a player to Duo A vs Duo B is a single, obvious action with no hidden double-click behavior.

---

## Context (read once)

Two punch-list items from Chris living in the app, both interaction-pattern problems that will confuse non-golf-savvy guys on first use — which is exactly the group this app has to work for (see PRODUCT_SPEC §4: "complexity lives in the app, never in a player's head"). Neither needs new data or engine logic; both are UI-layer fixes.

Grounding: `ARCHITECTURE.md` §2 (the PIN/identity flow this modal wraps — don't change the underlying auth, just how it's presented), `BRIEF_7_M3_REALTIME_LIVE_FEATURES.md` Part B (duo submissions — the *rule* is unchanged, this only fixes how a captain picks players).

---

## Scope — Part A: PIN sign-in as a modal/popup

Currently, signing in (the `IdentityPicker` flow — name selection → PIN entry, embedded inline per Brief 6's `redirectTo` fix) takes over the page. Convert it to a **modal/overlay** that appears on top of whatever the player was doing, rather than a full navigation:

- Trigger: same triggers as today (landing on the app signed out, or hitting a signed-out gate on `/score`, `/duos`, `/money`, etc.) — but instead of navigating to an embedded picker, open it as a modal over the current screen.
- On successful sign-in (PIN set or verified), the modal closes and the player is left exactly where they were, now signed in — no page reload, no navigation round-trip.
- Preserve everything Brief 6 already built underneath: the name picker, first-time PIN-set, returning PIN-verify, error states. This is a presentation change, not a logic change.
- Follow the mockup's sheet/modal pattern (`gui_invitational_mockup.html` uses a bottom-sheet style elsewhere, e.g., the reverse-mulligan confirm) for visual consistency — reuse that pattern rather than inventing a new one.

## Scope — Part B: Duo A/B selection — replace the double-click cycle

Currently, per Chris: selecting a player for Duo A takes one click; a second click on the same player cycles them to Duo B — a hidden, undiscoverable interaction. Replace with something explicit and obvious:

- A reasonable pattern: two clearly labeled slots/zones on screen — "Duo A" and "Duo B," each showing two player slots (4 total for the team). Tapping a player from the team roster assigns them to the next open slot, or the captain explicitly picks which slot (A or B) a tap fills — either works as long as **the assignment is visible and explicit at every step**, never an invisible state change from a repeat tap.
- Must support **reassignment**: tapping an already-placed player (to remove them, or move them to the other duo) should be an obvious, discoverable action — a clear "x" to remove, or a drag/tap-to-swap, not a hidden click-cycle.
- Must still work within the existing blind-submission mechanic (Brief 7 Part B) — this only changes *how* a captain builds the two duos before committing, not the commit/reveal behavior itself.
- Check the mockup's Draft/duo-adjacent screens for a visual pattern to model this on if one exists; otherwise, prioritize clarity over cleverness — this is exactly the kind of screen a non-golf-savvy captain needs to get right without asking Chris how it works.

---

## Verification

1. Sign-in flow opens as a modal from at least two different trigger points (landing signed out, and a signed-out gate on `/score` or similar); closes cleanly on success, leaves the player where they were.
2. Duo A/B assignment: a captain can place all four of their team's players into the correct duo slots without any double-click/cycle behavior; reassignment (moving or removing a placed player) is obvious and works.
3. No regression: the blind-reveal mechanic (neither team sees the other's picks until both commit) still holds; PIN sign-in/PIN-set logic (Brief 6) unchanged underneath the new presentation; all engine tests still green.

## Close-out

Short session addendum, to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` — closes two items from the July 22–23 punch list.
