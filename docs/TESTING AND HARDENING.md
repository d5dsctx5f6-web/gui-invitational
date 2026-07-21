# GUI INVITATIONAL — TESTING & HARDENING PLAN

**Why this doc exists:** the entire weekend's scoring runs on this app, live, in front of 16 people with money on the line. A wrong skins payout or a blown match state on Saturday morning destroys trust in the app for the rest of the trip — and there's no paper backup once everyone's relying on it. Correctness is not a feature; it's the whole product. Testing is therefore built in at every milestone, not bolted on at the end. v1.0

**Governing rule (from BUILD_PLAN):** a milestone is complete only when it survives Chris's thumbs on a real phone. Testing extends that rule — the app is trip-ready only when it has survived deliberate abuse, not just happy-path use.

---

## The four layers

### Layer 1 — Engine test suite (gates M2)
*Already required by ARCHITECTURE §4 and BUILD_PLAN M2.*

The scoring engine is a pure function (`(events, courseSetups, config) → derived state`) precisely so it can be tested exhaustively in isolation, with no database or UI in the way. A simulated-full-trip suite must be green before any human scores a real hole. It must cover, at minimum:

- Match state — F9 / B9 / 18 win/halve logic across a full 18, including matches that close early and holes played after a segment is decided.
- Points and standings — 3 points/match, 12/round, 24 total; correct cumulative ordering.
- Earned Sunday pairings — 1st v 2nd, 3rd v 4th derived from Saturday standings, including seeding ties.
- Individual net race — every shot counted twice, correct running totals.
- Handicap conversion — index → course handicap per course/tee (`Index × Slope/113 + (Rating − Par)`), dots landing on the correct stroke-index holes; per-player mixed tees; commissioner mid-trip index change.
- Do-overs — breakfast ball and mulligan produce a counted second score everywhere (match, individual, skins).
- **Reverse mulligan two-score rule** — the highest-risk logic in the app. Replay counts for the duo match; a holed shot's original score still stands for skins and individual. Test the divergent-score path explicitly.
- **Skins** — gross, opt-in; lowest among entrants only; non-entrant scores neither win nor block; carryover chains across multiple tied holes; a carryover pot resolving several holes later.
- Shortened event — Sunday incomplete → cup and individual decided on last completed round.
- Allowance math — once §5 open items are resolved and encoded.

The suite is the M2 gate: it passes, then Chris hand-audits one simulated trip's standings/skins/ledger against the engine's output.

### Layer 2 — Field Test 1 (real golf, real thumbs)
*Already in BUILD_PLAN as FT1, Sep–Oct 2026.*

Take M1 on an actual round with 2–3 buddies before the golf season closes. This catches what no unit test can: scorekeeper confusion, sunlight legibility, one-handed entry mid-round, the "how do I log a mulligan" hesitation. UX failures surface here or they surface on the trip.

### Layer 3 — Dress rehearsal (full system, multiple humans)
*Already in BUILD_PLAN as M4, Feb 2027.*

One fully simulated trip day with 3+ people on their own phones, end to end: admin setup → duos submitted → holes scored across groups → skins → challenge bets → settle-up. On production infrastructure, not localhost. Punch list from the rehearsal must be cleared before Freeze.

### Layer 4 — Hardening pass (deliberate abuse) — **NEW, gates Freeze**
Runs between M4 and Freeze (target: the last two weeks of Feb 2027). Where Layers 1–3 prove the app works when used correctly, this pass proves it survives the trip's real conditions: bad signal, simultaneous input, human error, and hardware variety. Every item is a drill with a pass/fail result.

**Concurrency & realtime**
- Four scorekeepers posting to four groups at once — standings stay consistent, every phone converges within seconds.
- Two scorekeepers editing the same group's hole near-simultaneously — last-write behavior is correct, no lost or duplicated scores.
- Spotty-signal simulation — enter scores with the phone in airplane mode / degraded connection; confirm entries reconcile correctly when signal returns (or that the failure mode is safe and obvious, never silent corruption).

**Commissioner corrections (the recompute drills)**
- Fix a score mid-round → match, skins, individual race, and ledger all recompute correctly and push to every phone.
- Retroactively toggle a player's skins opt-in; adjust a trip index between rounds; correct a mis-entered reverse mulligan. Each must ripple correctly through all derived state (this is the payoff of the store-raw-derive-everything design — prove it holds).

**Adversarial & malformed data**
- Impossible scores (a 2 on a par 5, a blank hole, a 15) — sane handling or clear guardrails.
- Wrong-group / wrong-player entry and its correction path.
- A challenge bet logged, accepted, then disputed → admin resolve/void works and the ledger stays correct.
- Reverse mulligan called at the edges — on a non-holed shot, interacting with a mulligan, at the exact timing boundary.

**Device & PWA spread**
- The oldest phone coming on the trip; at least one Android among the iPhones.
- PWA resumed after sitting backgrounded for hours (a full round) — reconnects and refreshes cleanly.
- Add-to-Home-Screen standalone mode behaves across iOS and Android.

**Recovery**
- The backup-restore drill from ARCHITECTURE §7 — take a nightly `pg_dump` and actually restore it to a scratch project, proving trip-week recoverability. This is a Freeze prerequisite, not optional.

**Exit criterion:** every drill above has a recorded pass (or a documented, accepted mitigation) before the app enters Freeze on Mar 1, 2027.

---

## Where testing lives in the timeline

| Phase | Layer | When |
|---|---|---|
| M2 | Engine suite green + hand audit | Nov 2026 |
| FT1 | Real-round field test | Sep–Oct 2026 |
| M4 | Dress rehearsal | Feb 2027 |
| **Hardening** | **Deliberate-abuse pass** | **Late Feb 2027** |
| Freeze | All drills passed; fixes only | Mar 1, 2027 |
| Trip week | Load courses/tees/indexes/buy-in; keep-alive + uptime confirmed | Mar 22–25, 2027 |

Trip-week is loading and final confirmation only — no new code. If a bug is bad enough to need a code change during Freeze or trip week, it goes through the normal brief → Claude Code → verify loop, never a live hot-edit.
