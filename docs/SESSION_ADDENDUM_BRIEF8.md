# Brief 8 — M3 Part 3: Schedule + Champions Wall · Session Addendum

**Date:** July 22, 2026

**Shipped:** All three parts, pushed to `main`. **This closes M3** — the entire live app is now
feature-complete per BUILD_PLAN.

## What was built

- **Part A — `/schedule`.** Read-only, grouped by day (Friday/Saturday/Sunday fall out naturally
  from grouping on `starts_at`'s date), pulling from `schedule_items` — unused since it was
  stubbed in Brief 2. Plain Server Component, no realtime: the brief explicitly said a full
  subscription isn't required for content this static, and `revalidatePath("/schedule")` from
  the admin actions already gets a fresh render on next visit with no redeploy, matching how
  Corrections originally worked in Brief 6 before realtime existed. Items with no time go in a
  "Time TBD" bucket at the end rather than being dropped.
- **Part B — admin schedule CRUD.** Create/edit/delete in a new `/admin` section — title,
  season, `datetime-local` input, optional notes.
- **Part C — `/champions`.** Loops over every row in `seasons` (confirmed by construction, not
  just by eye — there's no season-specific code path, Year Two in 2028 is just a new row).
  Three trophy lines per season (The Cup, Low Man, Skins King) matching the mockup exactly,
  each independently "— in play —" until admin sets it. **Chose to store admin-recorded winners
  rather than derive them live** from the standings/individual-race engine functions — the
  brief explicitly sanctioned this ("a close-out action is reasonable scope if simple"), and
  deriving live would have meant building the trip-wide multi-match standings aggregation this
  project has never had a UI for (Brief 5 only ever built the engine functions, no screen) —
  real scope creep for what's meant to be the cool-down brief. New admin form sets all three
  fields per season with a plain dropdown, no separate "close the season" flag needed since
  each trophy is independently nullable.
- **Migration `0020`**: three nullable FK columns on `seasons`
  (`cup_winner_team_id`, `individual_champion_player_id`, `skins_king_player_id`).
- **Nav**: `/schedule` and `/champions` added to the home page's nav row; `← Home` on both,
  matching the Brief 7.5 convention now that it exists.

## Bug caught and fixed before close

Same class of regression as Brief 7's admin fix: `/champions`' first draft selected the three
new trophy columns in the *same* query as `id, year, name`. On the live database (`0020` not
yet run), that made the whole query fail, and the page showed "No seasons yet" — hiding the
real Year One season entirely, not just the trophies. Caught live-testing against the actual
production database before close. Fixed with the same pattern already established for
`rounds.skins_buy_in`: fetch the trophy columns in a separate query, merge in defensively, so a
database that hasn't run `0020` yet still shows the season and just treats every trophy as
unset. This is now the third time this exact failure shape has shown up (skins_buy_in in
`/admin` and `/money`, now this) — worth remembering as a standing pattern: **any new column
added to a query some other feature already depends on needs its own separate fetch**, not
folded into the existing one, until the migration adding it has actually run everywhere.

## The `first_tee_at` note

The brief invited closing Brief 7's `first_tee_at` gap here "if convenient." Looked at it:
`schedule_items.starts_at` is a natural home for a round's first-tee time, but there's no FK
linking a schedule item to a specific `round_id` today, and wiring that link plus updating
`/duos`'s deadline display would have been its own small feature, not a trivial add. Left as a
noted future concern rather than forced in, per the brief's own explicit permission to skip it
if it complicates scope.

## Verification

Lint, typecheck, build (all 7 routes register), and `npm run test` (84/84) clean. Live
smoke-tested `/schedule`, `/champions`, and `/admin`'s two new sections against the actual
production database (which has `0017`–`0019` but not yet `0020`) — confirmed graceful
degradation, no console errors, no regressions on any existing screen (Teams, Matchups,
Handicap Indexes + Reset PIN, Corrections, Challenge Ledger all still render and function).
Did not click-test the schedule-item create form interactively — it's structurally identical to
already-proven admin CRUD patterns (`createTeam`, `createRound`), and it's inert content with
no identity risk either way; confident from code review plus the successful build.

## M3 is closed

Scoring, auth/admin, realtime, duos, skins, the Challenge Ledger, reverse mulligans, schedule,
and the champions wall are all built. The one thing still open is independent of this brief and
was already independent before it: **Brief 7's live two-device gate** (realtime sync, blind duo
reveal, a skins/ledger cycle, an RM call, all confirmed on two real devices) — migrations are
run, the code is there, it just hasn't been exercised live yet. Nothing in Brief 8 blocks or is
blocked by that.

## Next

Per BUILD_PLAN: **M4 — the dress rehearsal.** One fully simulated trip day with 3+ humans on
their own phones, admin setup through settle-up, end to end, on production infrastructure.
That's also the natural home for a UX/polish pass — real multi-human usage should drive that,
not more guesses made solo.
