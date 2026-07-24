# Brief 12 — UI Fixes: PIN Modal + Duo A/B Selection · Session Addendum

**Date:** July 23, 2026

**Shipped:** sign-in is now a bottom-sheet modal instead of a full-page takeover, and duo
selection is an explicit slot picker instead of a hidden tap-to-cycle. Pushed to `main`.

## Part A — PIN sign-in as a modal

New `app/SignInModal.tsx` (+ `SignInModal.module.css`) reuses the mockup's `.sheet`/`.sheetback`
bottom-sheet pattern: a dimmed backdrop and a sheet anchored to the bottom of the viewport,
containing the same two-step flow Brief 6 built (name select → PIN set/verify), now presented as
an overlay rather than page content.

Two call sites, matching the brief's two trigger types:

- **Home page** (`IdentityPicker.tsx`): the roster list stays exactly as it was — still nice to
  browse who's on the trip — but tapping a name now opens the modal pre-resolved to that player's
  PIN step (`preselectedPlayer` prop) instead of expanding an inline sheet below the list.
- **Signed-out gates** on `/score`, `/duos`, `/money` (new `app/SignInGate.tsx`): each page still
  renders its own minimal shell (back link + a one-line explanation, unchanged), but the picker no
  longer *is* the page. The modal auto-opens on mount (there's nothing else to do until you're
  signed in) over a compact "Sign in" button, and is dismissible/re-openable from there.

The bigger fix is underneath the presentation: `submitPin()` used to do
`window.location.href = redirectTo`, a hard browser navigation — the actual "page trip" feeling.
It now calls `router.refresh()` (Next.js soft refresh: re-runs the current route's Server
Components in place) and closes the modal. No URL change, no white-flash reload, no
`redirectTo` prop needed anymore since the modal never navigates away from where it was opened.

One implementation note: an early draft reset the modal's internal step via a `useEffect` keyed
on `open`, which React's `react-hooks/set-state-in-effect` lint rule correctly flagged (calling
`setState` synchronously in an effect body risks cascading renders). Fixed by splitting the
component in two — an outer `SignInModal` that only mounts an inner `SignInSheet` while
`open === true` — so every open is a fresh mount with fresh initial state, and the only effect
left is a genuine async data-fetch (resolving `preselectedPlayer`'s PIN mode via RPC, setting
state from the `.then()` callback, not synchronously).

## Part B — Duo A/B selection: explicit slots, not a click-cycle

`CaptainForm` in `app/duos/DuosScreen.tsx` used to cycle a tapped player through
off → Duo A → Duo B → off on repeat taps of the *same* button — exactly the "hidden,
undiscoverable interaction" the brief called out.

Replaced with four explicit slots — two under a "Duo A" label, two under "Duo B" — each either
showing `+ Add player` (dashed, empty) or a filled chip with the player's name and a `×`. Tapping
an empty slot opens a picker panel listing only the not-yet-placed roster players; tapping one
fills that exact slot and closes the panel. Tapping a filled slot's `×` clears it back to empty
and returns that player to the picker pool — an explicit, discoverable removal/reassignment
path (move a player between duos by clearing their slot, then filling the other duo's open slot),
per the brief's "either works as long as the assignment is visible and explicit at every step."

`Slot` was pulled out as its own top-level component (not defined inside `CaptainForm`'s render)
after `react-hooks/static-components` flagged the original inline version — components created
during render break memoization and violate the rule against defining components inside
components.

Commit logic (`duoA`/`duoB` arrays → `duo_a_player_1/2`/`duo_b_player_1/2`, the
`round_id,team_id` upsert, the one-player-in-Duo-A minimum) is unchanged — this was purely how
the captain *builds* the assignment before committing, not the commit/reveal mechanic itself,
matching the brief's scope.

## Verification

Lint, typecheck, build (all 7 routes), and `npm run test` (84/84) all clean.

**Live-tested, no real identity touched:**
- Sign-in modal: opened from the home page roster (resolved to an existing PIN's "verify" step
  for a real name already on the roster — confirmed the modal presents correctly, then backed out
  via "Back" without submitting any PIN), and from `/score`'s and `/money`'s signed-out gates
  (auto-opens on load, closes via `×`, reopens via the "Sign in" button, page shell underneath
  stays intact, no console errors).
- Duo A/B slot picker: `CaptainForm` is only reachable signed in as a real team's captain, which
  this project's standing practice (no completing a PIN sign-in as any of the 16 real players)
  rules out for testing. Verified instead with a temporary local-only QA route
  (`app/qa-duos-slots/page.tsx`) rendering the real `DuosScreen` component against fake,
  non-production team/player data — no real identity, no live database write. Confirmed: tapping
  an empty slot opens the picker scoped to only-unassigned players, tapping a player fills that
  exact slot and closes the picker, and the `×` on a filled slot clears it and returns the player
  to the pool. Deleted before committing — `git status` after cleanup shows no trace of it.

Neither change touches PIN verification/set logic (Brief 6) or the blind commit/reveal mechanic
(Brief 7 Part B) — both confirmed unchanged by reading the surrounding code, not just by absence
of a diff.

## Open items carried forward

Unchanged from Brief 11's addendum: migrations `0020`/`0021` still pending Chris running them;
Brief 7's live two-device gate and Brief 9's own live gate still outstanding; no `first_tee_at`
field; ARCHITECTURE §5 reconciliation still pending.

## Next

Chris's own live click-through of the duo slot picker as an actual team captain is the one thing
this session couldn't verify directly — recommended before or during M4. Otherwise, M4 (the dress
rehearsal) remains the next real milestone once the outstanding live gates above are cleared.
