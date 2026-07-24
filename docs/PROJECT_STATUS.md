# PROJECT STATUS — The GUI Invitational

**Last updated:** July 23, 2026 · **Status:** M3 is closed; Brief 9 (admin/UX hardening), Brief 10 (score routing fix), Brief 11 (RM visibility investigation, no code defect found), Brief 12 (PIN modal + duo A/B slot picker), and Brief 13 (duo resubmission fix + admin duo view/set/reset) all built and pushed on top of it. Outstanding: Brief 7's live two-device gate, Brief 9's own live verification, Chris's own live click-through of the duo slot picker as a real captain, and confirming the resubmission-before-reveal assumption from Brief 13 — all independent and can happen on their own schedule — read this first before resuming.

---

## Shipped & pushed

- **M0 — scaffold**: Next.js/TS PWA, Supabase, Vercel prod at [gui-invitational.vercel.app](https://gui-invitational.vercel.app), roster of 16 live.
- **Brief 2** — full DB schema + engine core (handicap conversion, net scoring, F9/B9/18 match state).
- **M1** — playable scorecard, verified on a real phone across a full 18.
- **Brief 4** — skins, reverse-mulligan two-score rule, individual race (34 tests).
- **Brief 5** — standings, earned Sunday pairings, chip-off tie surfacing, shortened event, allowance config, and the full simulated-trip suite (77 tests total, all green).
- **Scorecard fixes** — success/error write feedback, "already posted" indicator, running gross/net totals per player.
- **Brief 6 (M3 Part 1) — CLOSED, verified live**: the two carried-forward items closed (`reverse_mulligans` unique constraint; `hole_scores` interim anon-write revoked and replaced with an identity-scoped policy). Real player identity (name + 4-digit PIN, riding on Supabase Auth anonymous sign-in) and a passcode-gated `/admin` panel (teams, matchups, indexes, course setups, and the key one — corrections that ripple downstream with no redeploy). Verified live on Chris's phone: PIN sign-in works and persists, admin passcode gate works, a live score correction and a mulligan toggle both rippled through to the scorecard in real time with no redeploy. Three bugs were caught and fixed mid-verification: a sign-in dead-end (`092268c`), an anon-only-read RLS regression that silently emptied every table for any signed-in device (`d5a2882`), and a pgcrypto search_path gap that broke PIN-setting (`1535863`). See `SESSION_ADDENDUM_BRIEF6_CLOSED.md`.
- **Brief 7 (M3 Part 2) — code complete and pushed, migrations run and confirmed, live gate still pending**: realtime subscriptions (`hole_scores`, `reverse_mulligans`, `duo_submissions`, `skins_entries`, `challenge_bets`) with focus/visibility-regain refetch for backgrounded phones. `/duos` — blind duo submissions, blindness enforced structurally (no draft row exists until a captain's single atomic commit). `/money` — skins opt-in with live `computeSkins()` results, and the Challenge Ledger (log/accept/settle, admin void/reassign). Reverse-mulligan calling UI + two-score capture built into the Scorecard. Engine gained `moneyLedger.ts` (skins payouts + trip-wide running ledger); 84 tests total, all green. See `SESSION_ADDENDUM_BRIEF7.md`.
- **Brief 7.5 (punch-list) — CLOSED**: a `← Home` link added everywhere it was missing — turned out to be `/duos`, `/money`, `/score`'s two early-return states, and both of `/admin`'s (the gap wasn't only `/duos`/`/money` as first flagged). Admin can now reset a player's PIN (clears `player_auth` + every `player_devices` link for them), closing the gap flagged in Brief 7's addendum before broad live testing starts. See `SESSION_ADDENDUM_BRIEF7_5.md`.
- **Brief 8 (M3 Part 3) — CLOSED, closes M3**: `/schedule` — read-only, grouped by day, pulling from `schedule_items` (stubbed since Brief 2, unused until now). `/champions` — loops over every `seasons` row, three trophy lines each (Cup, Low Man, Skins King), independently "— in play —" until admin records a winner; admin-recorded at trip's end rather than derived live, a deliberate scope choice (deriving would mean building the trip-wide standings screen this project has never had a UI for). New admin sections for both. Migration `0020` adds the three nullable trophy columns to `seasons`. Caught and fixed the same class of regression as Brief 7 before close: `/champions`' first draft queried the not-yet-migrated trophy columns in the same call as the core season fields, which would have hidden Year One entirely on a pre-migration database — fixed with the by-now-standard decoupled-fetch pattern. See `SESSION_ADDENDUM_BRIEF8.md`.
- **Brief 9 (admin & UX hardening) — code complete and pushed, live gate pending**: admin delete for courses/rounds/teams/matches/challenge bets, dependency-aware confirmations backed by real `ON DELETE CASCADE` FKs (migration `0021`) rather than manual multi-step deletes. Rounds now display as "Course — Format" everywhere. Home page's primary actions are bigger and moved above the roster; back-links and the roster picker got real touch targets. The actual bug fix: admin never had a reverse-mulligan removal capability at all — built one, and it correctly clears the affected hole's stale `match_strokes` on removal, not just the event row. Scorecard now shows a course/format/date header. Skins opt-in is a confirm-then-lock one-way door for players, with an admin override to remove a mistaken entry. See `SESSION_ADDENDUM_BRIEF9.md`.
- **Brief 10 (score routing fix) — CLOSED**: `/score` no longer grabs "the first match in the table" — it derives the signed-in player's actual match from identity (`team_members` → `matches` → the specific slot via `duo_submissions`, since a team pairing is *two* match rows sharing the same team IDs, not one — team membership alone can't tell them apart). Verified by hand-tracing the real production data for the exact scenario that surfaced the bug (Zac Jones landing on the wrong matchup) plus a cross-check on an unrelated matchup and a same-foursome grouping check for the Brief 7 realtime gate — all three traced correctly. See `SESSION_ADDENDUM_BRIEF10.md`.
- **Brief 11 (RM visibility investigation) — CLOSED, no code defect found**: investigated the suspected "reverse mulligan calling only visible to team captains" regression. Full audit of `Scorecard.tsx`, `/score/page.tsx`, and every relevant RLS policy found no captain-based check anywhere — RM calling rights are already scoped to "either real player in the duo playing this match," exactly matching Rulebook v1.6 §5. Hand-traced 3 real non-captain players against live production data (including Team Jones' own captain's duo-B *player-2* slot, ruling out a subtler "first-listed player only" bug too) — all resolve and gain calling rights correctly. Added a clarifying comment at the check site to head off a future accidental regression via the (correctly) captain-scoped `duo_submissions` write policies. See `SESSION_ADDENDUM_BRIEF11.md`.
- **Brief 12 (PIN modal + duo A/B selection) — CLOSED**: sign-in is now a bottom-sheet modal (mockup's `.sheet`/`.sheetback` pattern) instead of a full-page takeover — new `SignInModal`/`SignInGate`, triggered from the home roster and from signed-out gates on `/score`/`/duos`/`/money`. The real fix underneath: `submitPin()` used to hard-navigate via `window.location.href`; it now calls `router.refresh()`, so success closes the modal in place with no reload and no `redirectTo` plumbing needed. Duo A/B selection in `/duos` no longer cycles a tapped player through off→A→B→off on repeat taps — replaced with four explicit slots (two per duo), each an empty "+ Add player" or a filled chip with a `×` to remove; tapping an empty slot opens a picker of only the not-yet-placed roster. Verified live for the modal (real triggers, no PIN submitted); the duo picker was verified against a temporary local-only QA route with fake data (never touching a real player identity), deleted before commit. See `SESSION_ADDENDUM_BRIEF12.md`.
- **Brief 13 (duo resubmission fix + admin override) — CLOSED**: diagnosed Chris's "stale duo picks" report and found the write path (`upsert` on `(round_id, team_id)`) has been correct since Brief 7 — confirmed zero duplicate rows in production. The real bug: `TeamStatusRow` stopped rendering `CaptainForm` the instant any submission existed, so a captain had no way back into the form to fix a mistake — not a failed write, an unreachable one. Fixed by letting the captain (never teammates) keep seeing the form pre-reveal regardless of submitted status, pre-filled from the existing picks, with a success message and an "Update duos" label once resubmitting. Also built the missing admin capability PRODUCT_SPEC §3 calls for: a new "Duo submissions" section in `/admin` showing every team's lineup per round (deliberately exempt from the blind-reveal rule — a commissioner override), direct set/edit via roster dropdowns, and a reset action. See `SESSION_ADDENDUM_BRIEF13.md`.

## M2 status: CLOSED

Chris's hand-audit passed both traces (net computation on a real-entered round: 85 gross − 20 dots = 65 net, matched and recomputed correctly on edit; skins void integrity confirmed via raw fixture data on two Sunday holes — genuine multi-way ties, no gaps or malformed data). The entire scoring engine — match state, handicaps, skins, the reverse-mulligan two-score rule, standings, earned pairings, shortened event, individual race — is complete and proven: 77 automated tests plus this human audit. See `SESSION_ADDENDUM_M2_CLOSED.md`.

## M3 Part 1 status: CLOSED

Verified live on Chris's phone: PIN sign-in works and persists across reload, the admin passcode
gate works, and — the key capability — a live score correction and a mulligan toggle made in
`/admin` both rippled through to the scorecard in real time with no redeploy. Three bugs were
caught and fixed mid-verification (sign-in dead-end, an anon-only-read RLS regression, and a
pgcrypto search_path gap breaking PIN-setting) — see `SESSION_ADDENDUM_BRIEF6_CLOSED.md` for the
full story. All fixes are in `main` and confirmed working.

**Open item, minor, not blocking:** `/admin` isn't directly addable to the home screen as its
own icon — the PWA manifest has a single `start_url: "/"`, so "Add to Home Screen" always
installs against `start_url` regardless of which page triggered it. `/admin` is still one tap
away from the home icon; a dedicated admin icon would need a second scoped manifest. Fix
whenever convenient.

## M3 Part 2 status: MIGRATIONS DONE, LIVE GATE PENDING

Migrations `0017`, `0018`, `0019` have been run against the live Supabase project and
confirmed — realtime publication entries, the new write policies for
`reverse_mulligans`/`duo_submissions`/`skins_entries`/`challenge_bets`, and
`rounds.skins_buy_in` are all live. What's left is the brief's own live verification gate (see
`SESSION_ADDENDUM_BRIEF7.md` for full detail):

- Two devices on the same match's scorecard, confirming a posted hole appears on the other
  within seconds with no manual refresh.
- Two captains submitting duos, confirming blind-until-both-commit then simultaneous reveal.
- Skins opt-in toggled by two different players, confirming the Money screen reflects only
  entrants.
- A Challenge Ledger bet logged, accepted (only by the named acceptor), and settled, confirming
  it lands in the running ledger.
- A reverse mulligan called on a holed shot, confirming the two-score entry works and
  availability shows correctly in both of that team's foursomes.

**Deliberately not attempted this session:** completing a PIN sign-in as any of the 16 real
roster players to test-drive these flows, since that would claim their identity slot with a
throwaway PIN and there's no admin "reset a player's PIN" capability yet to undo it. A
pre-migration smoke test did catch and fix one real regression: adding `skins_buy_in` to the
same query `/admin` used for Matchups/Corrections would have silently emptied that whole
section on the live (not-yet-migrated) database — fixed by decoupling the fetch.

**Open items, minor, not blocking:**
- No `first_tee_at` field in the schema — the 30-minutes-before-first-tee deadline is a static
  label, not a real countdown.
- ~~No admin "reset a player's PIN" capability~~ — closed by Brief 7.5.
- ~~`/score` hardcodes "grab the first match in the table"~~ — closed by Brief 10: routing is
  now identity-derived (team → duo slot), verified correct on both real matchups in production.

## M3 Part 3 status: CLOSED

`/schedule` and `/champions` are both built and pushed, migration `0020` is written (not yet
run against the live database — nothing depends on it being run immediately; both screens
degrade gracefully to "in play"/empty states until it is, same defensive pattern as
`skins_buy_in`). See `SESSION_ADDENDUM_BRIEF8.md` for full detail, including the note on why
`first_tee_at` wasn't closed here despite the brief inviting it (would have needed its own
schedule-item↔round link, more than "if convenient" scope).

## M3 status: CLOSED

All three parts are built and pushed. The **only** thing left from the entire M3 milestone is
**Brief 7's live two-device gate** (see the M3 Part 2 section above) — realtime sync, blind duo
reveal, a skins/ledger cycle, and an RM call, all confirmed on two real devices. That
verification is independent of Briefs 7.5 and 8 and can happen on its own schedule.

## Brief 9 (admin & UX hardening) status: CODE DONE, LIVE GATE PENDING

Not a milestone — a punch-list pass from Chris actually living in `/admin`. Everything is built
and pushed; migration `0021` (the delete cascades) hasn't run yet. See
`SESSION_ADDENDUM_BRIEF9.md` for full detail, including the FK schema decisions (two deliberate
`SET NULL`s instead of cascading further: a round's optional default tee, and a season's
recorded cup-winner team so deleting a team never rewrites champions-wall history).

**Honestly could not verify this session:** any admin write actually succeeding against the
live database — this local dev environment's `SUPABASE_SERVICE_ROLE_KEY` has always been a
placeholder (since Brief 6), so every admin action, not just this brief's new ones, has only
ever been write-verifiable in Chris's real environment. Did click-test the new reverse-mulligan
removal against a real row from earlier testing: the confirm gate and the Server Action both
fired correctly, and it failed cleanly with "Invalid API key" (the expected placeholder-key
failure, not a code bug) — no orphaned state, no crash, surfaced through the normal error
banner. Confirms the plumbing; the actual successful write is Chris's to run live.

**Still pending — this brief's own gate:**
1. Run migration `0021` in the Supabase SQL editor.
2. Delete a course/round/team/match/challenge bet with real dependents — confirm the message
   and the cascade.
3. Call and then remove a reverse mulligan — confirm the scorecard reverts to the real score.
4. Confirm skins opt-in's confirm-then-lock on a phone, and admin's override.
5. Eyeball the bigger nav/back-links/roster targets on an actual phone in daylight.

## Brief 10 (score routing fix) status: CLOSED

Fixed the bug Chris hit directly: signed in as Zac Jones, "Score a round" opened a matchup he
wasn't even in. `/score` now resolves the signed-in player's own match through
`team_members` → `matches` → the specific slot (A/B) via that round's `duo_submissions` row —
not `.limit(1)` on the matches table. The schema detail that mattered: a team pairing is two
`matches` rows sharing identical team IDs, so team membership alone can't disambiguate; the
real disambiguator is which duo slot the player's own `duo_submissions` entry puts them in.
Verified by hand-tracing real production data (not live click-testing, for the same
identity-squatting reasons as every prior brief) — Zac Jones resolves correctly to his real
matchup, Matt Lacko resolves independently to a different one regardless of row order, and all
four players sharing one foursome resolve to the same match, confirming Brief 7's realtime gate
still works. See `SESSION_ADDENDUM_BRIEF10.md`.

## Brief 11 (RM visibility investigation) status: CLOSED

No regression found. See the Shipped & pushed entry above and `SESSION_ADDENDUM_BRIEF11.md` for
the full diagnostic trail. Best-guess explanation for why the concern was raised: Chris, like
every session in this project, can only personally PIN-sign-in as himself for live testing (a
team captain) per the identity-squatting-avoidance policy — natural grounds for suspicion without
having traced the code against another real player's data, which this brief did.

## Brief 12 (PIN modal + duo A/B selection) status: CLOSED, ONE LIVE ITEM PENDING

Both punch-list items from Chris are built, verified (build/lint/84 tests, live smoke test of the
modal, fake-data QA pass on the duo picker), and pushed. See `SESSION_ADDENDUM_BRIEF12.md`.

**Still pending:** Chris clicking through the new duo A/B slot picker himself as a real team
captain — this session could not, since `CaptainForm` is only reachable signed in as an actual
captain, and completing a real PIN sign-in as any of the 16 players is the one thing this project
has consistently avoided throughout. Low risk (verified thoroughly against the real component
with fake data instead), but worth a quick real check before or during M4.

## Brief 13 (duo resubmission fix + admin override) status: CLOSED

Both parts built, verified (build/lint/84 tests, live admin read-view check against real
production data, fake-data QA pass for the captain resubmission flow), and pushed. See
`SESSION_ADDENDUM_BRIEF13.md`.

**Still pending:**
1. Chris confirming the resubmission-before-reveal assumption (Part B): defaulted to "captains
   can freely resubmit up until both teams commit and reveal" since the brief didn't spec this
   precisely — flagged, not assumed silently.
2. Admin's new `setDuoSubmission`/`resetDuoSubmission` writes couldn't be exercised end-to-end
   locally — same known `SUPABASE_SERVICE_ROLE_KEY` placeholder limitation as every admin write
   since Brief 6/9. Confirmed the failure mode is clean (no orphaned test data), but the actual
   successful write is Chris's to run live, same as every prior admin brief.

## Two must-do items now closed (were carried-forward before M3)

1. ~~Revoke the interim anon INSERT/UPDATE policies on `hole_scores`~~ — done in migration `0014`.
2. ~~Add `unique(team_id, round_id)` on `reverse_mulligans`~~ — done in migration `0012`.

## Also pending

Reconcile ARCHITECTURE §5 with the schema actually built (`course_tees` split, `duo_submissions` linkage, `par_by_hole`/`yardage_by_hole` columns, and now `player_auth`/`player_devices`). Demo-seed IDs for cleanup are recorded in `SESSION_ADDENDUM_M1.md`.

## Next up

Finish the two pending live gates (Brief 7's two-device realtime gate, Brief 9's
delete/RM-removal/skins-lock verification) whenever convenient — both independent of each
other, and Brief 10's routing fix doesn't block either. Then, per BUILD_PLAN: **M4 — the dress
rehearsal**, one fully simulated trip day with 3+ humans on their own phones, admin setup
through settle-up, end to end, on production infrastructure.
