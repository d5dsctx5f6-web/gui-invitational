# M1 — Playable Scorecard · Session Addendum

**Date:** July 20, 2026

**Shipped:** M1 gate met. Live scorecard screen (Scorekeeper view) on production, built on the Brief 2 engine core. Per-hole entry with steppers, live handicap dots, breakfast-ball/mulligan toggles, hole navigation, and live F9/B9/18 duo-match state. Three demo-seed migrations (0009 course-tee par/yardage columns + duo nullable adjustment, 0010 interim anon write policies on hole_scores, 0011 demo round seed). Full 18-hole round scored on a real phone; dots verified correct against stroke index (including the 18-handicap second-stroke wrap on SI 1/2), match segments close correctly when decided, raw scores written to Supabase and all match state derived.

**Commits:** `aa433c0` (docs: add Brief 3), `3936e16` (schema adjustments + interim anon write policy + demo round seed), `f9a945e` (the scorecard screen itself).

## Deviations / things to remember

- Migration 0010 opens interim anon INSERT/UPDATE on `hole_scores` (pre-auth, so the scorecard can post without a login). This MUST be revoked when the PIN/auth model lands (flag for the auth brief).
- Demo seed (course "Cottonwood Hills (Demo)", one shamble round, two demo teams, one match) is clearly marked and must be cleared before real data loads. Ids for cleanup:
  - Course: `68e406ea-7e4c-4e37-866b-0cc208f0d6c8` ("Cottonwood Hills (Demo)")
  - Round: `df3cf6c6-0b22-451a-8fbc-d1d49ff085a0` (2027-03-27, shamble)
  - Team 1: `2e2c0b9e-2d30-45c4-8abe-54d8e7380147` ("Demo Team 1")
  - Team 2: `bac5ba36-05d6-4865-8654-a71e6e284f30` ("Demo Team 2")
  - Match: `f392d3d0-5754-43ac-8c7e-0a0c8bf79c43` (slot A)
- `course_tees` gained `par_by_hole` and `yardage_by_hole` arrays for the scorecard display — reconcile into ARCHITECTURE §5 along with the Brief 2 schema notes.

## Open items (none blocking)

Field Test 1 is the next real-world checkpoint. Auth brief must revoke the interim write policies. ARCHITECTURE §5 still pending reconciliation.

## Next

Field Test 1 (real round with buddies, Sep–Oct), then Brief 4 — the full engine (M2 gate): skins, reverse mulligan two-score, individual race, standings + earned pairings, shortened event, allowances, and the simulated-full-trip test suite.
