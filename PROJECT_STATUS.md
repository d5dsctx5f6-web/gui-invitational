# PROJECT STATUS — The GUI Invitational

**Last updated:** July 22, 2026 · **Status:** build paused here — read this first before resuming.

---

## Shipped & pushed

- **M0 — scaffold**: Next.js/TS PWA, Supabase, Vercel prod at [gui-invitational.vercel.app](https://gui-invitational.vercel.app), roster of 16 live.
- **Brief 2** — full DB schema + engine core (handicap conversion, net scoring, F9/B9/18 match state).
- **M1** — playable scorecard, verified on a real phone across a full 18.
- **Brief 4** — skins, reverse-mulligan two-score rule, individual race (34 tests).
- **Brief 5** — standings, earned Sunday pairings, chip-off tie surfacing, shortened event, allowance config, and the full simulated-trip suite (77 tests total, all green).
- **Scorecard fixes** — success/error write feedback, "already posted" indicator, running gross/net totals per player. Latest commit `cc87648`.

## M2 status: CLOSED

Chris's hand-audit passed both traces (net computation on a real-entered round: 85 gross − 20 dots = 65 net, matched and recomputed correctly on edit; skins void integrity confirmed via raw fixture data on two Sunday holes — genuine multi-way ties, no gaps or malformed data). The entire scoring engine — match state, handicaps, skins, the reverse-mulligan two-score rule, standings, earned pairings, shortened event, individual race — is complete and proven: 77 automated tests plus this human audit. See `SESSION_ADDENDUM_M2_CLOSED.md`.

## Two must-do-before-M3 items (do not lose)

1. Revoke the interim anon INSERT/UPDATE policies on `hole_scores` when real auth lands (migration `0010` opened them pre-auth).
2. Add `unique(team_id, round_id)` on `reverse_mulligans` before any RM-writing UI ships.

## Also pending

Reconcile ARCHITECTURE §5 with the schema actually built (`course_tees` split, `duo_submissions` linkage, `par_by_hole`/`yardage_by_hole` columns). Demo-seed IDs for cleanup are recorded in `SESSION_ADDENDUM_M1.md`.

## Next up

**Brief 6 — M3** (live multiplayer + admin panel + blind duo submissions + skins opt-in + Challenge Ledger + schedule + champions wall), including the two carried-forward items above.
