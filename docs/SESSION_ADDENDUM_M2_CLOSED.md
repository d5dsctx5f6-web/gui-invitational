# M2 — Officially Closed · Session Addendum

**Date:** July 22, 2026

## M2 is closed

Chris's hand-audit passed both traces:

- **Net computation**, verified live against a real-entered round: 85 gross − 20 dots = 65 net. Matched, and recomputed correctly on edit (posting a corrected score flowed through to the running total without a stale value left behind).
- **Skins void integrity**, confirmed via raw fixture data for two Sunday holes: both showed genuine multi-way ties at the low score among complete, gapless entrant data — no missing rows, no malformed entries. The void status the engine reported was the correct call, not a symptom of bad data.

The entire scoring engine — match state (F9/B9/18), handicap conversion, gross skins (opt-in, carryover, non-entrant invisibility), the reverse-mulligan two-score rule, team standings with the full tiebreak ladder, earned Sunday pairings, shortened-event fallback, and the individual net race — is **complete and proven**: 77 automated tests plus this human audit.

## Also fixed this session

- **Scorecard write feedback**: the M1 scorecard's "Post hole" action was silently succeeding with no confirmation, which read as broken. Added a clear success banner and a loud, visible error banner (never silent), plus an "already posted — editing" indicator so a scorekeeper always knows whether they're looking at a fresh hole or correcting a saved one.
- **Running totals**: each of the four players in a match now shows running gross, running net, and holes completed, computed via the engine (not recomputed by hand in the UI).

**Commits:** `cc87648` (scorecard write feedback + running totals), plus the M2 engine work already landed through `325640d`.

## Next

**Brief 6 — M3**: live multiplayer + admin panel + blind duo submissions + skins opt-in UI + Challenge Ledger + schedule + champions wall. Two carried-forward items to fold into that work:

1. Revoke the interim anon INSERT/UPDATE policies on `hole_scores` (migration `0010`) once real auth lands.
2. Add `unique(team_id, round_id)` on `reverse_mulligans` before any RM-writing UI ships.
