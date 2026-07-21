# PROJECT STATUS — The GUI Invitational

**Last updated:** July 21, 2026 · **Status:** build paused here — read this first before resuming.

---

## Shipped & pushed

- **M0 — scaffold**: Next.js/TS PWA, Supabase, Vercel prod at [gui-invitational.vercel.app](https://gui-invitational.vercel.app), roster of 16 live.
- **Brief 2** — full DB schema + engine core (handicap conversion, net scoring, F9/B9/18 match state).
- **M1** — playable scorecard, verified on a real phone across a full 18.
- **Brief 4** — skins, reverse-mulligan two-score rule, individual race (34 tests).
- **Brief 5** — standings, earned Sunday pairings, chip-off tie surfacing, shortened event, allowance config, and the full simulated-trip suite (77 tests total, all green). Latest commit `325640d`.

## M2 status

Engine engineering-complete, all 77 tests green. The M2 gate is the human hand-audit via `npm run audit` — **this hand-check is still pending Chris's sign-off.** The audit script was run and its output walked through in session, but Chris has not yet confirmed the printed standings/skins/individual numbers match his own math. **M2 is not officially closed until that hand-check passes.**

## Two must-do-before-M3 items (do not lose)

1. Revoke the interim anon INSERT/UPDATE policies on `hole_scores` when real auth lands (migration `0010` opened them pre-auth).
2. Add `unique(team_id, round_id)` on `reverse_mulligans` before any RM-writing UI ships.

## Also pending

Reconcile ARCHITECTURE §5 with the schema actually built (`course_tees` split, `duo_submissions` linkage, `par_by_hole`/`yardage_by_hole` columns). Demo-seed IDs for cleanup are recorded in `SESSION_ADDENDUM_M1.md`.

## Next up

Finish the M2 hand-audit if not done, then **Brief 6 — M3** (live multiplayer + admin panel + blind duo submissions + skins opt-in + Challenge Ledger + schedule + champions wall).
