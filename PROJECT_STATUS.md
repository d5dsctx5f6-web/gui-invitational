# PROJECT STATUS — The GUI Invitational

**Last updated:** July 21, 2026 · **Status:** Brief 7 / M3 Part 2 migrations run and confirmed; live two-device gate still pending — read this first before resuming.

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
- No admin "reset a player's PIN" capability — worth adding before broad live testing.
- `/score` still hardcodes "grab the first match in the table" — fine for the realtime gate
  test (wants two devices on the *same* match) but will need a real match picker before four
  simultaneous foursomes each need their own live scorecard on trip day.

## Two must-do items now closed (were carried-forward before M3)

1. ~~Revoke the interim anon INSERT/UPDATE policies on `hole_scores`~~ — done in migration `0014`.
2. ~~Add `unique(team_id, round_id)` on `reverse_mulligans`~~ — done in migration `0012`.

## Also pending

Reconcile ARCHITECTURE §5 with the schema actually built (`course_tees` split, `duo_submissions` linkage, `par_by_hole`/`yardage_by_hole` columns, and now `player_auth`/`player_devices`). Demo-seed IDs for cleanup are recorded in `SESSION_ADDENDUM_M1.md`.

## Next up

Finish the M3 Part 2 gate above, then **Brief 8 (M3 Part 3)**: the schedule/itinerary screen and the champions wall.
