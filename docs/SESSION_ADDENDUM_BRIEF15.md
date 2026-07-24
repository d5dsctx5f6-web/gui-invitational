# Brief 15 — Fix: Stale Leaderboard Data + Rounds Admin Cleanup · Session Addendum

**Date:** July 24, 2026

**Shipped:** the real (and different-from-hypothesized) source of the stale leaderboard data,
a targeted migration to remove exactly that data, a light admin guardrail, and a per-round
grouped Rounds & Matchups screen. Pushed to `main`.

## Part A — Diagnosis: the brief's own hypothesis doesn't match reality

Queried the live production database directly rather than assuming. Findings, in order:

1. **There is exactly one round in the entire database** — "GreyHawk," `2027-01-01`. No second
   round, no "Cottonwood Hills (Demo)" round, exists.
2. **The Brief 3/M1 demo scaffold (migration `0011`) is already gone.** Queried `courses` and
   `teams` directly: no "Cottonwood Hills (Demo)" course, no "Demo Team 1"/"Demo Team 2" — that
   cleanup had already happened at some earlier point in the project's history. Spencer
   Petersen's presence in the stale data is **coincidental**, not evidence of the old demo match.
3. **The actual cause:** the one real GreyHawk round has two matchups — Deliso-v-Jones (which
   Chris is actively, genuinely scoring right now) and Lacko-v-Spenny. The Lacko-v-Spenny side
   has a **complete 18-hole round already posted** for Dominic Ikeler, Ian Hastings, Spencer
   Petersen, and Grant Brogan — plausible-looking real golf scores (3s through 11s), plus one
   fully-formed reverse-mulligan call (Team Spenny on Dominic Ikeler, hole 17, confirmed via
   `/admin`'s Reverse Mulligans list). This has every hallmark of a genuine earlier end-to-end
   verification pass (almost certainly from this project's own Briefs 6–9 testing) that was never
   cleared, sitting in the *same* round Chris later resumed using for real, live scoring on the
   *other* matchup.
4. Confirmed the exact count match to Chris's report by loading `/leaderboard` before touching
   anything: Spencer Petersen +73, Dominic Ikeler +94, Grant Brogan +95, Ian Hastings +97, all
   "thru 18" — identical to the numbers in the brief.

**This changes the fix.** Brief 15's Part B assumed deleting "the offending round" would be the
tool — but there is no separate offending round to delete. The stale data and Chris's real
in-progress data share the exact same `round_id`. Deleting the round (Brief 9's cascade tool)
would have destroyed Chris's real active Deliso-v-Jones scores along with the stale ones. The
correct, verified fix is row-level: delete only the stale players' `hole_scores` (and the one
stale `reverse_mulligans` row tied to the same session), leaving the round, both teams' real
match/duo_submissions structure, and every real posted score untouched.

## Part B — The cleanup migration

New `supabase/migrations/0022_cleanup_stale_hole_scores.sql` — not a schema change, a one-time
targeted data fix:
- Deletes `hole_scores` for Dominic Ikeler, Ian Hastings, Spencer Petersen, and Grant Brogan,
  scoped to this specific `round_id`.
- Also deletes the one stale `reverse_mulligans` row (Team Spenny, hole 17, victim Dominic
  Ikeler) — caught while reviewing `/admin`'s Reverse Mulligans list during verification. Left in
  place, this would have falsely shown Team Spenny's one-per-round RM as already used, blocking
  them from calling a real one later in this same round. It's tied to the same stale test
  session, not a standing structure, so it goes with the rest.
- Deliberately does **not** touch Team Lacko or Team Spenny's `matches`/`duo_submissions` rows —
  those are real, legitimate structure for an ongoing real matchup, not stale data.

**Not run yet** — same as every prior migration in this project, this is Chris's to run in the
Supabase SQL editor. Confirmed via a live `/leaderboard` load that the exact numbers (+73/+94/
+95/+97, "thru 18") reproduce against the current unfixed database, so the migration's targeting
is verified correct before it's ever executed.

## Part C — Round-count guardrail

Added a simple conditional note to `/admin`'s Rounds & Matchups section: if more than 2 rounds
exist, a visible gold-bordered note reads "N rounds exist — SPEC calls for 2 competitive rounds
per trip." Kept intentionally light per the brief's own instruction — no new "official round"
flagging system. **Not building anything heavier is the right call here**: Part A's findings show
the actual problem wasn't "too many rounds" (there's only ever been one) but stale *scores*
within a real round for a matchup Chris hadn't gotten to yet — a round-count guardrail wouldn't
have caught this specific case, but it's still a reasonable, cheap tripwire for the more common
future failure mode (an actual stray extra round from testing), and matches exactly what the
brief asked for.

## Part D — Rounds & Matchups reorganized per round

Each round now renders as its own bordered card (new `.roundCard` class — a 1px `--seam` border
distinct from the thin `--seam2` divider every other flat-list admin section still uses), with:
- The round's header (course/format/date) and Delete Round action, unchanged in placement.
- Its skins buy-in control.
- A small "Matchups" label, then its matchups nested underneath — visually and structurally
  scoped to that round, never interleaved with another round's.
- "Add a round" stays outside every round card, at the section's bottom, unchanged.

No collapse/expand added — with the trip's real round count expected to stay at 1–2, per the
brief's own "don't over-build this" guidance, plain per-round cards with normal scrolling is
sufficient. No new capability was added; every existing action (save/remove matchup, delete
round, set buy-in, add round) works exactly as before, just visually grouped.

## Verification

Lint, typecheck, build (all 8 routes), and `npm run test` (84/84) all clean.

**Live-verified against real production data:**
- Reproduced the exact reported bug on `/leaderboard` before any fix: Spencer Petersen +73,
  Dominic Ikeler +94, Grant Brogan +95, Ian Hastings +97, all thru 18 — confirms the migration
  targets precisely the right rows.
- Confirmed via `/admin`'s live Reverse Mulligans list that the stale RM call exists and belongs
  to the same stale session (Team Spenny, Dominic Ikeler, hole 17) — this is what caught the
  need to extend the migration beyond just `hole_scores`.
- Confirmed the new `.roundCard` styling is correctly applied via computed style inspection
  (`border: 1px solid` the established `--seam` color, `border-radius: 4px`, `padding: 12px`) and
  structurally verified the "Matchups" label and per-round nesting via page-text extraction (a
  browser-tool screenshot-after-scroll rendering glitch prevented a clean visual capture this
  session, unrelated to the code itself — computed-style + DOM-structure inspection substituted).
- Round-count note correctly does not render with the current 1 round (condition is `> 2`,
  verified in code and absent from the live page dump).

## Open items carried forward

- **Migration `0022` still needs Chris to run it** in the Supabase SQL editor — same as `0020`
  and `0021` before it, none of which have been confirmed run yet either.
- Everything else unchanged from Brief 14's addendum: Part C (Sunday pairings preview) still
  deferred, realtime confirmation for `/leaderboard` bundled into Brief 7's live two-device gate,
  the resubmission-before-reveal assumption from Brief 13, Brief 9's own live gate, no
  `first_tee_at`, ARCHITECTURE §5.

## Next

Once Chris runs `0020`, `0021`, and now `0022`, the database will be fully caught up with every
migration this project has written. After that, M4 — the dress rehearsal — remains the next real
milestone.
