# Brief 20 — Admin Corrections Reorganization · Session Addendum

**Date:** July 26, 2026

**Shipped:** a pure UI reorganization, same write behavior underneath. Pushed to `main`.

## What changed

`/admin`'s Corrections section used to render every `hole_scores` row for the selected round in
one flat list — for a round with 4+ matchups that's dozens of undifferentiated rows, exactly the
"so overwhelming" shape Chris flagged. It's now a three-level drill-down, same spirit as Brief
15 Part D's Rounds & Matchups cards:

- **Round** — reuses the existing `RoundPicker` link component unchanged (it was already shared
  with the Duo Submissions section).
- **Match** — new: lists the round's matchups as "Team A v Team B — Slot S" links, picks the
  first one by default.
- **Hole** — new: one hole at a time, prev/next nav mirroring `Scorecard.tsx`'s own
  `.holehead`/`.navrow`/`.bignum` pattern (disabled-looking, non-clickable state at holes 1 and
  18, same as the live scorecard), showing exactly the 4 players relevant to that match.

All three levels are plain server-rendered `<a href>` links carrying query params
(`?round=…&cmatch=…&chole=…`) — no client component, no new JS shipped, consistent with how
`RoundPicker` already worked. `cmatch`/`chole` are named distinctly from the existing `round`
param so they can't collide with anything else on this page.

## Resolving "the 4 relevant players" for a match

Reused the same duo-slot-resolution insight this project has leaned on since Brief 10: a team
pairing is two `matches` rows sharing team IDs, disambiguated only by `duo_submissions`. Added a
local `matchPlayerIds()` — structurally the same as `/score`'s and the leaderboard's own
resolution, just server-side in `admin/page.tsx`.

**Deliberate fallback, not in the original brief text but necessary for the "nothing lost"
requirement:** if no duo submission exists yet for a team in this round, `matchPlayerIds()` falls
back to that team's full roster (both sides) rather than showing zero players. Real hole_scores
rows can only exist for players who were once routed through a resolved duo submission (Brief 10
made `/score` itself require one), so this is a rare edge, not a live scenario — but it means an
admin resetting a duo submission mid-trip (a real capability, built in Brief 13) can never make an
already-posted score temporarily unreachable in Corrections.

## Safety net: unmatched scores

Also added, not asked for explicitly but directly motivated by this project's own history: any
`hole_scores` row that doesn't resolve to a player in *any* of the round's current matches is
still surfaced, in a small "other scores not tied to a current matchup" section at the bottom of
Corrections, using the exact same row form the old flat list used. This is direct insurance
against a repeat of **Brief 15's exact failure shape** — stale hole_scores rows for players
outside the round's active match structure, sitting invisibly alongside real live data. Currently
empty in production (no orphaned rows), but it closes a real gap the pure drill-down would
otherwise open silently.

## The one behavior change beyond pure reorganization

`correctHoleScore` (`app/admin/actions.ts`) previously redirected on both success and validation
error straight to `/admin?msg=…` or `/admin?err=…` — dropping all query-string context. That was
mostly invisible in the old flat list (worst case: your round selection reset). With the new
drill-down, every single hole's save would have bounced the admin all the way back to round 1 /
no match / hole 1 — turning "find and correct a score without scrolling" into "find it, fix it,
then re-navigate from scratch for the next one." That directly undermines the brief's own gate
("live, under pressure, during real scoring"), so `correctHoleScore` now reads optional
`roundId`/`matchId`/`hole` hidden fields and redirects back to the same drill-down location on
both success and error. The actual `hole_scores` UPDATE query itself — fields, validation, RLS
path via `createAdminClient()` — is byte-for-byte unchanged.

## Verification

- `npm run lint` — clean.
- `npm run build` — clean, all 8 routes, no TypeScript errors.
- `npm test` — 90/90, unchanged (no engine changes).
- **Live-verified reads/navigation against real production data**, logged into `/admin` with the
  real passcode:
  - Cottonwood Hills round loaded with its one matchup (Team BroMei v Team Nintendo — Slot A)
    auto-selected, hole defaulted to 1, and exactly the 4 correct players shown (Grant Brogan,
    Ben Meier, Chris Deliso, Matt Lacko) — matching that round's actual `duo_submissions` exactly.
  - Hole nav (`Hole 2 →`) produced the correct URL and correctly re-rendered hole 2 with the same
    match's same 4 players.
  - Switching rounds (Cottonwood Hills → GreyHawk) correctly reset match/hole to that round's own
    first matchup and hole 1, rather than carrying over a stale match ID from the other round.
  - Deep-linked to GreyHawk hole 13 directly and confirmed the pre-existing reverse-mulligan data
    (Grant Brogan, real score 5, `match_strokes` 5) surfaced correctly in the right form field —
    proof the hole-scoped filtering reads the right row, not just the right player.
  - No "unmatched scores" fallback rendered for either round — correctly silent when there's
    nothing orphaned.
  - No console errors throughout.
- **Write path — could not be live-verified from Claude Code**, and this is expected, not a
  gap introduced by this brief: `SUPABASE_SERVICE_ROLE_KEY` in local `.env.local` is a documented
  placeholder (confirmed directly: 30 characters, literal `placeholder-loc…` prefix), so
  `createAdminClient()` has no real credentials locally — this has been true for every admin
  write action across this entire project, not something Brief 20 changed. To actually confirm
  this wasn't purely theoretical, submitted a real toggle (breakfast-ball checkbox, GreyHawk hole
  13, Ben Meier — a value confirmed `false` beforehand) through the live form. It correctly failed
  with Supabase's own `Invalid API key` error (proof no write reached production — nothing was
  mutated) **and** the page redirected back to the exact same round/match/hole rather than
  resetting, which is precisely the new redirect-preservation logic being exercised on its error
  path. The success path runs the identical code, just without the `flashHere("err", …)` branch —
  reasoned through, not independently observed, same limitation as every prior admin-write brief.

## Out of scope, confirmed untouched

Rounds & Matchups card layout (Brief 15), the correction mechanism's downstream ripple to
`/score`/`/leaderboard` (unchanged, still `revalidatePath` on both), and every other admin
section (Teams, Duo Submissions, Handicap Indexes, Course Setups, Challenge Ledger, Reverse
Mulligans, Skins Entries, Schedule, Champions Wall) — all rendered and functioned identically in
the live check above.

## Open items carried forward

Unchanged from Brief 19's addendum, plus one addition: Chris should confirm on his own device
(real service-role key, real write path) that saving a Corrections edit both persists and lands
back on the same round/match/hole — the one piece this session couldn't observe end-to-end.
Migrations `0020`/`0022`/`0023` confirmed run (per the live database check earlier this session);
`0021`'s actual FK cascade behavior still needs Chris to confirm via the Supabase SQL editor
(anon-key REST queries can't see `pg_constraint`). Also still open: the resubmission-before-reveal
assumption from Brief 13, Brief 7's live two-device gate, Brief 9's own live gate, ARCHITECTURE §5.

## Next

Once Chris confirms the Corrections write path and runs the three pending migrations, the
database is fully caught up. M4 — the dress rehearsal — remains the next real milestone.
