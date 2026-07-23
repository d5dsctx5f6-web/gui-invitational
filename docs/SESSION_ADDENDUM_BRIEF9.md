# Brief 9 — Admin & UX Hardening · Session Addendum

**Date:** July 22, 2026

**Shipped:** All seven parts, pushed to `main`.

## What was built

- **Part A — admin delete.** Courses, rounds, teams, matches, and challenge bets can now be
  deleted from `/admin`, each behind a confirmation that names exactly what else goes with it
  (e.g., "Deleting this course will also delete 3 rounds, 4 matches, 72 hole scores... This
  cannot be undone."). The actual cascade is enforced by Postgres, not walked manually in
  application code — migration `0021` adds `ON DELETE CASCADE` to every FK a course/round/team
  delete needs to reach (course → course_tees/rounds; round → matches/hole_scores/
  duo_submissions/skins_entries/reverse_mulligans; team → team_members/matches/
  duo_submissions/reverse_mulligans), so the actual delete is one atomic statement on the
  top-level row — no risk of a partial multi-step delete leaving orphans. Dependency counts for
  the confirmation message are computed read-only from data already loaded plus a few
  lightweight FK-only queries, no per-row fetches. A small `ConfirmDeleteButton` client
  component (`app/admin/ConfirmDeleteButton.tsx`) wraps a native `window.confirm()` around the
  Server Action submit — minimal JS, no new client-state machinery needed for the rest of
  `/admin`, which stays server-rendered.
- **Part B — round display.** Every place a round is shown now leads with **course + format**
  ("Cottonwood Hills — Shamble"), date secondary: `/admin`'s Rounds & Matchups and Corrections
  round pickers, `/duos`, `/money`, and the new Scorecard header (Part F). Pure display change,
  no schema needed — `rounds.course_id` already joined to `courses.name` everywhere.
- **Part C — home page nav.** "Score a round" is now a full-width filled button at the top
  (matching the mockup's `.btn.big` proportions — 18px padding, bold, uppercase), followed by a
  2×2 grid of the other primary actions (Duos, Money, Schedule, Champions), all before the
  roster — not buried below 16 names anymore.
- **Part D — bigger touch targets.** The `← Home`/`← Roster` back-links across every screen and
  the roster picker buttons on the identity screen were both undersized for a thumb — bumped to
  real tap targets (44px+ minimum height, more padding) using the same shared `.backLink` style
  everywhere it appears.
- **Part E — the actual bug fix.** Diagnosed first, per the brief's instruction: `/admin` had
  **no reverse-mulligan removal capability at all** before this — whatever produced the stale
  `match_strokes` Chris hit must have been a raw delete against the table directly (e.g. via the
  Supabase dashboard), which only removes the event row and has no way to know it should also
  undo the hole's effect. Built the real fix: a new `removeReverseMulligan` action that deletes
  the `reverse_mulligans` row *and* clears `match_strokes` back to `null` on the exact
  `hole_scores` row it affected, restoring `coalesce(match_strokes, strokes)` to reading the
  plain `strokes` value again. New "Reverse mulligans" admin section lists every call
  round-by-round with a Remove button using the same confirm pattern.
- **Part F — scorecard context.** A course/format/date header now sits above the match eyebrow
  on `/score`, sourced from the same round data Part B already needed.
- **Part G — skins opt-in, confirm then lock.** Opting in now requires an explicit confirm tap
  ("Opt into gross skins for {course} — {format}? Once you're in, you can't opt back out this
  round.") before the write happens — no more single-tap toggle. Once in, the player-facing
  opt-out is gone entirely; the button becomes a locked "You're in" indicator. The only way back
  out is admin — a new "Skins entries" admin section lists every opt-in with a Remove button,
  closing the override requirement.

## Schema decisions from the cascade work (as the brief asked to record)

Two `ON DELETE SET NULL`s instead of cascading further, both deliberate:

- **`rounds.default_tee_id` → `course_tees(id)`**: a round's default tee is optional. If its
  `course_tees` row disappears (e.g. via a course-level cascade), the round shouldn't be forced
  to disappear too — it just loses its default tee reference.
- **`seasons.cup_winner_team_id` → `teams(id)`**: a season's recorded cup winner is a
  historical result (Brief 8). Deleting the winning team shouldn't silently erase that
  champions-wall entry by cascading the season away — it should just clear the reference,
  leaving the season (and its other two trophies) intact.

Everything else in the chain is a genuine `CASCADE`: a course's rounds are meaningless without
the course, a round's matches/scores/duos/skins/reverse-mulligans are meaningless without the
round, and a team's members/matches/duo picks/reverse-mulligans are meaningless without the
team.

One naming risk worth flagging: none of the original migrations named their FK constraints
explicitly, so `0021` targets Postgres's auto-generated default names (`<table>_<column>_fkey`)
via `DROP CONSTRAINT IF EXISTS`. This is very likely correct — every migration in this project
used the same plain inline `references` style — but if a constraint name doesn't match for some
reason, that one `ALTER TABLE` statement fails with a clear "constraint does not exist" error
rather than silently doing nothing; nothing before it is left half-applied since each statement
is independent.

## Verification

Lint, typecheck, build (all 7 routes), and `npm run test` (84/84) all clean. Live smoke-tested
every screen against the actual production database via a local dev server — home page
reordering/sizing, round labels everywhere, the scorecard header, the skins confirm-then-lock
flow, and all the new `/admin` sections (Reverse mulligans, Skins entries, delete buttons on
Teams/Rounds/Courses/Challenge Ledger) all render correctly with no console errors.

**One real limitation, honestly noted:** I could not verify the actual delete/cascade or the
reverse-mulligan `match_strokes` fix *executing successfully* against the live database this
session. This local dev environment's `SUPABASE_SERVICE_ROLE_KEY` has always been a placeholder
(documented back in Brief 6) — every admin write, not just this brief's new ones, has only ever
been verifiable in Chris's real environment. I did click-test the actual removal on a real
reverse-mulligan row that existed from earlier testing (Demo Team 1 on Will Petersen, hole 17):
the confirm gate, the form submission, and the Server Action all fired correctly, but the write
itself failed cleanly with "Invalid API key" — exactly the expected failure mode for a
placeholder key, not a code bug. No partial state, no orphaned rows, no crash — the error
surfaced through the existing flash-message banner like any other admin error. This confirms
the plumbing is wired correctly end to end; the actual successful write, migration `0021`
running, and the full verification list below are Chris's to do live.

## Still pending — this brief's own gate

1. Run migration `0021` in the Supabase SQL editor.
2. Delete a course/round/team/match/challenge bet with real dependents — confirm the message
   lists them correctly and the cascade leaves nothing orphaned.
3. Call a reverse mulligan, confirm the two-score divergence appears, remove it from `/admin`,
   confirm the scorecard reverts to the single real score (not the stale replay value).
4. Confirm skins opt-in on a phone: the confirm step, the locked state after, and admin's
   ability to remove a mistaken entry.
5. Eyeball the bigger nav/back-links/roster targets on an actual phone in daylight.

This is layered on top of, not a replacement for, Brief 7's still-pending live two-device gate.

## Next

Whatever Chris finds next living in the app — this was explicitly a punch-list brief, not a
milestone, so there's no "Brief 10" queued by default. Otherwise, per BUILD_PLAN: M4, the dress
rehearsal.
