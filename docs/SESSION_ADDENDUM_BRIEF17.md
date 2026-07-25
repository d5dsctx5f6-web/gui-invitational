# Brief 17 — Tee Time Slotting · Session Addendum

**Date:** July 24, 2026

**Shipped:** matches can now carry a real tee time, assignable from admin, surfaced on the
scorecard header, the duo submissions deadline, and `/schedule`. Pushed to `main`.

## Part A — Schema

New `supabase/migrations/0023_matches_tee_time.sql` — adds `tee_time timestamptz` (nullable) to
`matches`. A single timestamp covers both "what time" and "what order" (sort ascending), per the
brief's own framing — no separate ordering column needed. **Not run yet** — same as `0020`,
`0021`, and `0022` before it.

## Part B — Admin: assign tee times

`upsertMatch` now accepts an optional `teeTime` (a `datetime-local` value, converted to ISO or
`null` if left blank). Each matchup row in `/admin`'s per-round cards (Brief 15 Part D) gained a
tee-time input right next to team A / team B / slot; the same "Save" submit clears it too when
the field is emptied — no separate clear action needed. The "Add matchup" form got the same
field for setting a tee time at creation.

## Part C — Surfacing tee times

- **Scorecard header:** shows `· 9:00 AM tee` after course/format/date when the match's own
  `tee_time` is set; omitted cleanly when it isn't.
- **Duo submissions deadline:** now computed as the round's *earliest* `tee_time` across its four
  matches, minus 30 minutes, formatted as a real clock time. Falls back to the original generic
  "30 minutes before [date]'s first tee" text when no tee times exist yet for the round — the
  fallback isn't a stub, it's the same text that was already there.
- **`/schedule`:** added as its own clearly-labeled card per round ("Tee times — GreyHawk ·
  Shamble"), one line per matchup labeled by team pairing *and* slot (since slot A and slot B of
  the same pairing share team names and would otherwise be indistinguishable), sorted by time.
  Chose a separate section over merging into the existing day-grouped `schedule_items` cards —
  those group by a timestamp's calendar day, while rounds only have a plain date; matching the
  two into one unified chronological list would have meant a fragile date-label join for a modest
  visual win. A round with no matches yet renders nothing (no empty card).

## A real bug caught during verification: decoupled fetches, again

Migration `0023` hasn't been run yet, so `matches.tee_time` doesn't exist in production right
now. My first pass added `tee_time` directly into three **existing** `matches` queries (`/score`'s
identity-based match resolution, `/admin`'s core matches fetch, `/duos`'s matches fetch) —
confirmed live against production that this fails the entire query (`column matches.tee_time does
not exist`, `data: null`), which would have silently broken `/score` routing for everyone,
emptied `/admin`'s whole Matchups section, and dropped `/duos`'s pairing data, all before Chris
even runs the migration. Caught this by directly querying production with the new column before
trusting the build/lint pass alone.

Fixed by applying the same decoupled-fetch pattern this project has used since Brief 8
(`skins_buy_in`, season trophies): each of those three places now fetches tee_time in a
**separate** query and merges it in, so a pre-migration database keeps every existing screen
working exactly as before — only the tee-time-specific display gracefully shows nothing until
`0023` runs. `/schedule`'s tee-times section is new this brief (nothing existing depends on its
`matches` fetch), so no decoupling was needed there — a failed fetch there just means the section
doesn't render, which is correct pre-migration behavior anyway.

## Saturday/Sunday-via-format — noted, not acted on

Per the brief's own side note: `rounds.format` already fixes shamble to Saturday and four-ball to
Sunday per Rulebook v1.6, which means "which round is Saturday" (the reason Brief 14 skipped its
optional Sunday-pairings preview) is now trivially derivable — `round.format === "shamble"`. Not
acting on it this brief, per the brief's own "only if genuinely trivial alongside this brief's
real scope" instruction — Brief 14's Sunday-pairings-preview is a distinct, separate piece of
work (computing `computeEarnedPairings()` from Saturday-only outcomes and rendering a card), not
something that falls out of this brief's actual scope for free. Flagging it as newly unblocked for
whenever that item comes back up.

## Verification

Lint, typecheck, build (all 8 routes), and `npm run test` (86/86) all clean.

**Live-verified against real (pre-migration) production data:**
- `/schedule` renders its existing content correctly with no tee-times section showing (expected
  — no tee times exist yet), no console errors.
- `/duos`'s deadline computation takes the fallback branch cleanly (confirmed via code trace: the
  decoupled tee-time fetch returns `null`/`[]` on a pre-migration database, which resolves to the
  original generic fallback text, not a crash).
- `/admin`'s Rounds & Matchups renders all 4 matchups with their team/slot controls intact, and
  the 5 new tee-time `datetime-local` inputs (4 matchups + 1 "Add matchup") are all present and
  correctly typed — confirmed via DOM inspection. No console errors, nothing else on the page
  broke.

## Open items carried forward

- Migrations `0020`, `0021`, `0022`, and now `0023` all still need Chris to run them.
- Everything else unchanged from Brief 16's addendum: the resubmission-before-reveal assumption
  from Brief 13, Brief 7's live two-device gate, Brief 9's own live gate, no `first_tee_at` (tee
  times are per-matchup now, but a single "first tee" countdown label was never built and still
  isn't — out of this brief's scope), ARCHITECTURE §5.

## Next

Once Chris runs the four pending migrations, the database is fully caught up with every
migration this project has written. M4 — the dress rehearsal — remains the next real milestone.
