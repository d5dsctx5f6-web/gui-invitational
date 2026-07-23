# PROJECT STATUS — The GUI Invitational

**Last updated:** July 22, 2026 · **Status:** M3 is closed — all three parts built and pushed. The only thing outstanding is Brief 7's live two-device gate, which is independent of everything since and can be verified on its own — read this first before resuming.

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
- `/score` still hardcodes "grab the first match in the table" — fine for the realtime gate
  test (wants two devices on the *same* match) but will need a real match picker before four
  simultaneous foursomes each need their own live scorecard on trip day.

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

## Two must-do items now closed (were carried-forward before M3)

1. ~~Revoke the interim anon INSERT/UPDATE policies on `hole_scores`~~ — done in migration `0014`.
2. ~~Add `unique(team_id, round_id)` on `reverse_mulligans`~~ — done in migration `0012`.

## Also pending

Reconcile ARCHITECTURE §5 with the schema actually built (`course_tees` split, `duo_submissions` linkage, `par_by_hole`/`yardage_by_hole` columns, and now `player_auth`/`player_devices`). Demo-seed IDs for cleanup are recorded in `SESSION_ADDENDUM_M1.md`.

## Next up

**M4 — the dress rehearsal** (per BUILD_PLAN): one fully simulated trip day with 3+ humans on
their own phones, admin setup through settle-up, end to end, on production infrastructure. Also
the natural home for a UX/polish pass, driven by real multi-human usage rather than more guesses
made solo. Brief 7's live two-device gate (above) can happen before, during, or independently of
kicking that off.
