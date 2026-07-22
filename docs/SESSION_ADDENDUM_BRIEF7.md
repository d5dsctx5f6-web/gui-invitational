# Brief 7 — M3 Part 2: Realtime + Live Features · Session Addendum

**Date:** July 21, 2026

**Shipped:** All five parts of Brief 7, code-complete and pushed to `main`. Live gate NOT yet
verified — see "Still pending" below, same pattern as Brief 6's M3-Part-1 close.

## What was built

- **Part A — realtime foundation.** A reusable `useRealtimeRefetch` hook
  (`lib/supabase/useRealtimeRefetch.ts`) subscribes to `postgres_changes` on a table
  (optionally filtered to one `column=value`) and calls a refetch callback on any change; it
  also refetches on tab focus/visibility regain, so a phone that was backgrounded for 20
  minutes catches up on resume rather than trusting a possibly-dropped subscription. Wired
  into the Scorecard (`hole_scores`, `reverse_mulligans`), the new Duos screen
  (`duo_submissions`), and the new Money screen (`skins_entries`, `hole_scores`,
  `challenge_bets`). Migration `0017` adds all five live tables to the `supabase_realtime`
  publication — without it, RLS would still be correct but nothing would ever stream.
- **Part B — blind duo submissions** (`/duos`). Round-scoped; a round picker appears if more
  than one round exists. A team's actual captain (`teams.captain_player_id`) sees a tap-to-cycle
  roster picker (each player cycles None → Duo A → Duo B → None) and a commit button; everyone
  else sees read-only status. **The blind mechanic is enforced structurally, not just in the
  UI**: a captain's picks are never persisted as a draft — the only write is one atomic upsert
  at commit time, containing the final Duo A/B assignment and `committed_at` together. Since no
  row exists in `duo_submissions` until commit, there's nothing in the database for an opposing
  captain to see early even if they queried the table directly — genuine blindness, not just a
  withheld UI. Once both teams' rows exist, reveal is automatic and simultaneous by construction
  (the moment the second commit lands, both clients' realtime subscription fires and both duos
  become visible). After a captain's own commit, the screen deliberately shows "submitted,
  waiting on opponent" rather than re-displaying their own picks — a soft UX choice the brief
  itself called "arguably" necessary, not a technical requirement.
- **Part C — skins opt-in**, folded into `/money`. A per-round toggle any signed-in player can
  hit for themselves; entrant list is visible to everyone (per SPEC, unlike duos). Live
  `computeSkins()` results shown as dollar amounts once a round has a buy-in set, or skin
  counts if not (buy-in is genuinely unset in production right now — SPEC §6 listed it as a
  pending Chris-supplies input from day one, and this never hard-blocks on it).
- **Part D — Challenge Ledger**, also on `/money`. Log a bet (proposer names the other party,
  stake, free-text terms) → `status = 'proposed'`. Only the named acceptor can accept →
  `'open'`. Either named party can mark a winner → `'settled'`. Admin can void or reassign a
  winner from `/admin` (new "Challenge Ledger" section). The running ledger combines skins
  payouts **from both rounds** (not just the one currently selected) with all settled bets,
  via two new pure engine functions.
- **Part E — reverse mulligan calling UI**, inside the Scorecard. Visible only to a signed-in
  player who's actually in the match (determined by which duo their player ID appears in — no
  extra query needed), showing their team's live availability via the existing
  `reverseMulliganStatus()`. Confirm sheet: pick the victim (opposing duo only), state whether
  the shot was already holed. If holed, the real score is captured right there and the
  scorecard's stroke stepper for that player/hole switches from "strokes" to a separate "match
  score" stepper — `strokes` locks to the real value, `match_strokes` is what's adjustable,
  exactly matching the two-score rule. If not holed, nothing special happens — the existing
  single stepper already represents the correct final value, no divergence needed. The unique
  constraint from Brief 6 (`reverse_mulligans_one_per_team_round`) is the backstop; a race hits
  Postgres error `23505`, caught and shown as "already used this round" instead of a raw DB
  error.
- **Engine:** `moneyLedger.ts` — `skinsPayouts()` (pot = entrants × buy-in, split evenly across
  18 holes regardless of how many carried into a win) and `runningLedger()` (skins payouts +
  settled bets, winner +stake / loser −stake). 7 new tests; suite is now 84 tests, all green.
- **Migrations:** `0017` (realtime publication), `0018` (write policies for `reverse_mulligans`,
  `duo_submissions`, `skins_entries`, `challenge_bets` — each scoped to the specific player(s)
  the action belongs to, tighter than `hole_scores`'s intentionally loose Brief 6 scoping),
  `0019` (`rounds.skins_buy_in`, nullable).

## Bug caught and fixed before close

Adding `skins_buy_in` to the same `rounds` query `/admin` already used for Matchups and
Corrections meant that, on the live database (which hasn't run `0019` yet), the *entire* query
failed — silently emptying not just the new buy-in field but the whole Rounds & Matchups
section and the Corrections round picker, even though three real rounds already exist. That's
Brief 6's actual headline capability going dark because of an unrelated new column. Caught by
smoke-testing `/admin` against the live pre-migration database before close. Fixed by fetching
`skins_buy_in` in a separate query in both `/admin` and `/money`, merged in defensively — a
missing column there now degrades to "buy-in unset," not "rounds don't exist." Re-verified live
against production: all three rounds and their matchups reappeared immediately.

## Design decisions worth flagging

- **No tee-time field exists in the schema.** The brief allows "a countdown or a clear deadline
  label" for the loose 30-minutes-before-first-tee enforcement on duo submissions and skins
  opt-in. Built the label ("Deadline: 30 minutes before {date}'s first tee — not hard-blocked
  after"), not a countdown, since there's no `first_tee_at` timestamp anywhere to count down
  to. Building that infrastructure felt like scope creep on this brief; flagged below as a
  possible future addition if Chris wants a real countdown.
- **RM "was it holed" is a manual judgment call**, entered by whoever calls it. The data model
  only tracks final gross strokes per hole, not individual shots, so the app has no way to
  infer this from existing data — it has to be told, at the moment of calling, by whoever's
  scoring live.
- **The Money screen combines skins and the Challenge Ledger** into one screen, matching the
  mockup's single "Money" screen rather than the brief's Part C/Part D split — they share the
  same running-ledger concept and the mockup already established this as one experience.
- **The running ledger is trip-wide**, summing both rounds' skins (each computed with that
  round's own buy-in) plus every settled bet — not scoped to whichever round happens to be
  selected. This matches SPEC's "one settle-up number per man at trip's end" more literally
  than a strict per-round reading of Part D would have.
- **Blind duo mechanic has the same threat-model ceiling as Brief 6's PIN hijack note**: nothing
  at the RLS layer stops a technically-inclined opposing captain from querying
  `duo_submissions` directly the instant their own team's row would exist — the blindness holds
  today only because that row genuinely doesn't exist until commit. A `SECURITY DEFINER` reveal
  function would close this for real; not built here, matches the project's established
  friends-trip threat model.

## Verification done this session

Lint, typecheck, and `npm run build` all clean; `npm run test` green at 84/84; engine isolation
intact (no framework imports crept into `/engine`). Live smoke-tested all five routes
(`/`, `/score`, `/duos`, `/money`, `/admin`) against the actual production Supabase database via
a local dev server — all render without crashing even though `0017`–`0019` haven't run there
yet, confirming the app degrades gracefully rather than breaking during the gap between this
push and Chris running the migrations. Found and fixed the admin regression above during this
pass.

**What could not be verified this session, on purpose:** the actual interactive flows — duo
commit + blind reveal across two sessions, a skins opt-in write, a Challenge Ledger bet's full
log → accept → settle cycle, an RM call with two-score entry, and real cross-device realtime
propagation. Two deliberate reasons: (1) `0017`–`0019` haven't run against the live database
yet, so the new write policies and realtime publication entries don't exist there — any write
attempt right now would fail with permission-denied regardless of anything else; (2) completing
a PIN sign-in as any of the 16 real roster players during automated testing would claim that
player's identity slot with a throwaway test PIN they wouldn't know, and there's currently no
admin "reset a player's PIN" capability to undo that. Both point at the same next step: this is
genuinely Chris's gate to verify live, same as Brief 6's.

## Still pending — the actual M3-Part-2 gate

1. Chris runs migrations `0017`, `0018`, `0019` in order in the Supabase SQL editor.
2. Live verification, together, per the brief's own gate: two devices on the same match's
   scorecard, confirm a posted hole appears on the other within a few seconds with no manual
   refresh; two captains submit duos, confirm blindness holds until both commit then reveal
   fires simultaneously; toggle skins opt-in as two different players, confirm the Money screen
   reflects only entrants; log a Challenge Ledger bet, confirm only the named acceptor can
   accept it, settle it, confirm it lands in the running ledger; call a reverse mulligan on a
   holed shot, confirm the two-score entry and confirm availability shows correctly in both of
   that team's foursomes.

## Open items

- No `first_tee_at` field — deadline labels are qualitative, not a real countdown. Add if
  Chris wants an actual countdown later.
- No admin "reset a player's PIN" capability yet — worth having before broader live testing
  with real players, so a mis-tap or a testing PIN doesn't lock someone out with no recovery.
- `/score` still hardcodes "grab the first match in the table" (`.limit(1).maybeSingle()`) — a
  pre-existing M1-era simplification, unrelated to this brief's scope, but worth fixing before
  four simultaneous foursomes all need their own live scorecard on trip day.
- Carried forward: ARCHITECTURE §5 reconciliation still pending.

## Next

**Brief 8 (M3 Part 3):** schedule/itinerary screen and the champions wall — the remaining
content screens, lower stakes than this brief's live/interactive core.
