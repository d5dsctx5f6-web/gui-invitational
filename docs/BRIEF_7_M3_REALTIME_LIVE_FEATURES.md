# BRIEF 7 — M3 PART 2: REALTIME + LIVE FEATURES

**Project:** The GUI Invitational app · **Milestone:** toward M3 (part 2 of 3) · **Issued:** Jul 21, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 6 complete and verified live (PIN auth, admin panel, corrections proven to ripple through in real time — commit `9d68e64`).
**Gate:** Chris and at least one other signed-in player have the scorecard open on two different devices simultaneously; a hole posted on one appears on the other within a few seconds, with no manual refresh. Separately: a full blind-duo-submission cycle (two captains submit, reveal fires only once both commit), a skins opt-in toggle, a Challenge Ledger bet logged/accepted/settled, and a reverse mulligan called from the scorecard — each demoed live on a real device.

---

## Context (read once)

Brief 6 proved identity and correction-propagation work — but that was tested by one person (Chris) making one change and reloading to see it. **This brief proves the "live" in live-scoring app**: multiple real people, multiple real devices, seeing the same truth update without anyone touching refresh. It also finally builds the four features that have had their engine logic ready since Brief 4 but no interface: duo submissions, skins opt-in, the Challenge Ledger, and the reverse-mulligan calling flow.

Grounding: `PRODUCT_SPEC.md` §2 (duo submissions, skins, Challenge Ledger — all canonical here), `ARCHITECTURE.md` §3 (store-raw-derive-everything — realtime just means *pushing* the same raw events faster, not changing what's derived), `GUI_INVITATIONAL_RULEBOOK.md` v1.6 §4 and §6 (duo blind-reveal mechanics, money rules), `gui_invitational_mockup.html` (Matches, Money screens — this brief makes those real).

**What's already built and just needs a UI:** the engine's `computeSkins()`, `reverseMulliganStatus()`/two-score split, and the match-state functions from Briefs 2/4/5 are done and tested. This brief is wiring real-time data flow and building the missing screens — not new engine logic, except where noted (Challenge Ledger has no engine function yet; it's simple enough to build directly).

---

## Scope — Part A: Realtime (the foundation this brief sits on)

- Wire **Supabase Realtime** subscriptions on the tables that change live during a round: `hole_scores`, `reverse_mulligans`, `duo_submissions`, `skins_entries`, `challenge_bets`.
- Wherever the app currently fetches-once-and-renders (the scorecard, match state, standings if visible), convert to fetch-then-subscribe: initial load stays the same, but an incoming change re-derives and re-renders without a manual reload.
- Keep the engine boundary intact: realtime payloads are raw events; the app re-runs the same pure `/engine` functions on the updated data. No new derived-state logic, just faster raw-data delivery.
- Reasonable UX for a live update landing: a subtle confirmation (a toast, a highlight) is nice but not required — the requirement is correctness (state updates) over polish.
- Handle a device reconnecting after being backgrounded/offline: on resume, do a fresh fetch (don't trust a stale subscription silently) so a phone that was in someone's pocket for 20 minutes catches up correctly.

## Scope — Part B: Blind duo submissions

Per SPEC §2 / Rulebook §4: before each round, each captain privately submits Duo A and Duo B. Reveal happens **simultaneously** once both captains have committed — not before.

- A captain-only screen (any signed-in player who is a team's `captain_player_id` for that round sees it; others don't) to pick two players for Duo A and two for Duo B from their team's roster, and commit.
- **Blind mechanic:** until *both* captains for a given match have `committed_at` set, neither captain (nor anyone else) sees the other team's picks — and arguably not even confirmation of their own beyond "submitted, waiting on opponent." Once both are committed, reveal fires for everyone simultaneously (realtime push makes this natural: the moment the second commit lands, both clients re-fetch and both duos are visible to all).
- Enforce the **30-minutes-before-first-tee deadline** loosely for now — surface it in the UI (a countdown or a clear deadline label) but don't hard-block submission after it; that's an admin/commissioner judgment call in practice, not a system lock. Note this as an explicit choice in the addendum.
- Reshuffling between rounds: this is just a new `duo_submissions` row for the new round — no special "carry forward" logic required, a captain re-submits each round.

## Scope — Part C: Skins opt-in

Per SPEC §2: each player opts in or out per round, before that round's first tee.

- A simple toggle any signed-in player can hit for themselves, per round: in or out of gross skins. Writes to `skins_entries`.
- Show current entrant count / who's in (per SPEC — visibility isn't secret, unlike duos). Read `computeSkins()` (Brief 4) live once entries + scores exist, so the Money screen can show real running skins results, not just a static opt-in toggle.
- Lock opt-in after the round's first tee the same loose way as duo deadlines — surfaced, not hard-enforced (that's an admin call).

## Scope — Part D: Challenge Ledger

Per SPEC §2 / Rulebook §6: any player logs a bet against any other; the counterparty accepts to make it official; someone marks a winner; it hits the running ledger.

This has no existing engine function — build it directly, it's simple:
- **Log a bet:** proposer picks the other player, states stake and terms (free text — "closest to the pin on 16," whatever). Writes a `challenge_bets` row, `status = 'proposed'`.
- **Accept:** the named acceptor (and only them) can tap accept → `status = 'open'`. Until accepted, it's not official — show it as pending, only visible/actionable to the two named parties (others can see it exists per SPEC's transparency, but only the parties act on it — confirm this against the mockup's Money screen pattern).
- **Settle:** either party (or admin) marks a winner → `status = 'settled'`, `winner_player_id` set.
- **Dispute/void:** admin can void or reassign a winner from `/admin` (per SPEC §3 commissioner control) — a small admin addition to Brief 6's panel.
- **The running ledger:** a per-player net view — sum of skins winnings/losses (from Part C) plus settled challenge bets, one number per player. This is the "one settle-up number per man" from SPEC §2 — build it as a straightforward derived view, doesn't need to be a formal `/engine` function unless it turns out non-trivial.

## Scope — Part E: Reverse-mulligan calling UI

The engine logic (two-score rule, per-team availability) has existed since Brief 4. This brief builds the button.

- On the scorecard, during an active match, a **"Call reverse mulligan"** action — visible to a signed-in player on the *opposing* team of the match being scored, showing live (via realtime) whether their team's one-per-round RM is still available. Must reflect availability correctly across **both** of a team's foursomes simultaneously (Brief 4's `reverseMulliganStatus()` already computes this — wire it, don't recompute).
- Calling it: select the victim (a player in the match), confirm. Writes a `reverse_mulligans` row. The `reverse_mulligans_one_per_team_round` unique constraint (Brief 6) is the backstop against double-calling — surface a clean error if somehow raced, don't let a confusing DB error leak to the UI.
- **The replay + two-score entry:** once called, the scorekeeper needs to enter the replay result. If the original shot had already been posted as `strokes` and it was holed, the UI must let the scorekeeper set `match_strokes` to the replay result while `strokes` (the real, holed value) stays untouched — this is the two-score capture the schema has supported since Brief 2 (`hole_scores.match_strokes`) and Brief 4's engine reads correctly. Non-holed reversals are simpler: just update `strokes` directly, no divergence, no `match_strokes` needed (per the clarified Rulebook v1.6 rule).
- Follow the mockup's confirm-sheet pattern for calling it (a deliberate tap-to-confirm, not accidental).

---

## Verification (the M3-Part-2 gate)

1. **Realtime:** two devices (Chris + one other signed-in tester, or two browser sessions logged in as different players) both viewing the same match's scorecard/state; post a hole on one, confirm the other updates within a few seconds with no manual refresh.
2. **Duo submissions:** simulate two captains (two sessions) — confirm neither sees the other's picks until both commit, then both reveal simultaneously.
3. **Skins:** toggle opt-in as two different players, confirm `computeSkins()` output on the Money screen reflects only entrants.
4. **Challenge Ledger:** log a bet as player A, confirm player B (and only B) can accept it, settle it, confirm it appears in both players' running ledger.
5. **Reverse mulligan:** call one on a holed shot from the scorecard, confirm the two-score entry works, confirm match state reflects the replay while skins/individual (if visible) reflect the real score. Confirm availability shows correctly in both of that team's foursomes.
6. No regression: Brief 6 auth/admin flows still work; all engine tests still green; `/engine` isolation intact.

## Deferred to Brief 8 (M3 part 3 — do NOT build here)

Schedule/itinerary screen · champions wall. This brief is the live, interactive core of the trip experience — those two are content screens, lower stakes, next.

## Close-out

Session addendum (shipped / commits / deviations / open issues — especially note the "loose deadline enforcement" choices in Parts B/C, and any realtime edge cases hit), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md`.
