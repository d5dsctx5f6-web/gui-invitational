# Brief 7.5 — Punch-List Fixes: Navigation + PIN Reset · Session Addendum

**Date:** July 22, 2026

**Shipped:** Both punch-list items, pushed to `main`.

## Part A — navigation

Added a `← Home` link (shared `.backLink` style, `app/page.module.css`) to every screen that
lacked one. The five-minute audit the brief asked for found the gap was bigger than just
`/duos` and `/money`:

- `/duos` and `/money` — every state (signed-out picker, "no rounds yet", and the normal
  signed-in screen).
- `/score` — turned out to have the same gap on its two early-return states (signed-out picker,
  "no match seeded"); its signed-in Scorecard already had `← Roster`, so that one was fine.
- `/admin` — the passcode gate and the main panel header both lacked it too.

Reused the exact plain-text uppercase link style already established on the Scorecard's
`← Roster`, rather than inventing a new pattern, per the brief's instruction.

## Part B — admin PIN reset

New `resetPlayerPin` server action, next to each player's row in the Handicap Indexes section
(the existing per-player roster list — the natural home for this). Deletes both the
`player_auth` row (so their next sign-in is treated as first-time) and every `player_devices`
row for that player (so old device linkages don't silently keep working). Chose to clear all
their devices, not just one: a PIN reset means "this player is locked out or a device is
lost," and there's no way to know which of possibly several linked devices is the stale one —
full reset is the simpler, correct default for 16 friends. No new migration needed — `/admin`
already writes through the service-role client, which bypasses RLS entirely, same as every
other admin action.

## Verification

Lint, typecheck, build, and `npm run test` (84/84) all clean. Live smoke-tested all four routes
against the actual production database (migrations 0017–0019 already run) via a local dev
server: `← Home` renders and is a real link on every state checked, no console errors, no
regressions on existing flows. Confirmed "Reset PIN" renders correctly next to all 16 players
in `/admin`. **Deliberately did not click it during this pass** — same reasoning as Brief 7's
addendum: several of the 16 real players already have live PINs/device links from Chris's own
testing (visible in the Challenge Ledger — two real settled bets already exist), and clicking
reset on a real player during automated testing would disturb state Chris may be relying on.
The action itself is a straightforward two-table delete through the already-proven service-role
path; confident in it from code review plus the successful build, but the actual
click-and-confirm-it-locks-out-then-resets-cleanly test is Chris's to run on a player he
chooses.

## Next

**Brief 8 (M3 Part 3):** schedule/itinerary screen and the champions wall.
