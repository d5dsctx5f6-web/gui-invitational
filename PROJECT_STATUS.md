# PROJECT STATUS — The GUI Invitational

**Last updated:** July 22, 2026 · **Status:** build paused here — read this first before resuming.

---

## Shipped & pushed

- **M0 — scaffold**: Next.js/TS PWA, Supabase, Vercel prod at [gui-invitational.vercel.app](https://gui-invitational.vercel.app), roster of 16 live.
- **Brief 2** — full DB schema + engine core (handicap conversion, net scoring, F9/B9/18 match state).
- **M1** — playable scorecard, verified on a real phone across a full 18.
- **Brief 4** — skins, reverse-mulligan two-score rule, individual race (34 tests).
- **Brief 5** — standings, earned Sunday pairings, chip-off tie surfacing, shortened event, allowance config, and the full simulated-trip suite (77 tests total, all green).
- **Scorecard fixes** — success/error write feedback, "already posted" indicator, running gross/net totals per player.
- **Brief 6 (M3 Part 1) — code complete, pushed, gate NOT yet verified**: the two carried-forward items closed (`reverse_mulligans` unique constraint; `hole_scores` interim anon-write revoked and replaced with an identity-scoped policy). Real player identity (name + 4-digit PIN, riding on Supabase Auth anonymous sign-in) and a passcode-gated `/admin` panel (teams, matchups, indexes, course setups, and the key one — corrections that ripple downstream with no redeploy). A sign-in dead-end (`/score`'s fallback led nowhere) was caught and fixed same-session. Latest commit `092268c`. See `SESSION_ADDENDUM_BRIEF6.md`.

## M2 status: CLOSED

Chris's hand-audit passed both traces (net computation on a real-entered round: 85 gross − 20 dots = 65 net, matched and recomputed correctly on edit; skins void integrity confirmed via raw fixture data on two Sunday holes — genuine multi-way ties, no gaps or malformed data). The entire scoring engine — match state, handicaps, skins, the reverse-mulligan two-score rule, standings, earned pairings, shortened event, individual race — is complete and proven: 77 automated tests plus this human audit. See `SESSION_ADDENDUM_M2_CLOSED.md`.

## M3 Part 1 status: CODE DONE, GATE PENDING

Everything Brief 6 asks for is built and pushed, but **the brief's own verification gate has not run yet** — it needs Chris to do four things first (see `SESSION_ADDENDUM_BRIEF6.md` for full detail):

1. Run migrations `0012`, `0013`, `0014` (in order) in the Supabase SQL editor.
2. Enable **Anonymous sign-ins** in the Supabase dashboard (Authentication → Sign In / Providers) — can't be done via SQL.
3. Add `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_PASSCODE` (both server-only) to `.env.local` and Vercel (Production + Preview), then redeploy.
4. Live verification together: sign in as a real player on a phone, confirm it survives reload; unlock `/admin`, edit a team/index/matchup, and correct a `hole_scores` row live.

## Two must-do items now closed (were carried-forward before M3)

1. ~~Revoke the interim anon INSERT/UPDATE policies on `hole_scores`~~ — done in migration `0014`.
2. ~~Add `unique(team_id, round_id)` on `reverse_mulligans`~~ — done in migration `0012`.

## Also pending

Reconcile ARCHITECTURE §5 with the schema actually built (`course_tees` split, `duo_submissions` linkage, `par_by_hole`/`yardage_by_hole` columns, and now `player_auth`/`player_devices`). Demo-seed IDs for cleanup are recorded in `SESSION_ADDENDUM_M1.md`.

## Next up

Finish the M3 Part 1 gate above, then **Brief 7 (M3 Part 2)**: realtime subscriptions, blind duo submission UI + simultaneous reveal, skins opt-in toggle, the Challenge Ledger UI, and the reverse-mulligan calling UI in the scorekeeper flow.
