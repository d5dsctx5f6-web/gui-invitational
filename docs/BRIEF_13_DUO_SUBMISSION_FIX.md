# BRIEF 13 — FIX: STALE DUO SUBMISSIONS + ADMIN OVERRIDE

**Project:** The GUI Invitational app · **Type:** bug fix + missing admin capability · **Issued:** Jul 23, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 12 shipped (duo A/B selection UI fix, commit `74f3470`).
**Gate:** re-submitting a team's duo lineup for a round correctly replaces the previous submission (not silently ignored); Chris can view and reset any team's duo submission for any round from `/admin`.

---

## Context (read once)

Chris set a team's Duo A/B lineup, then later observed his phone showing **different (stale/old) players** in those slots — from an earlier test session — and re-submitting or attempting to fix it directly in Supabase didn't change what displayed. This points at two distinct problems, both real:

1. **The write path likely isn't upserting correctly.** `duo_submissions` has a unique constraint on `(round_id, team_id)` — exactly one row per team per round. If the current write is a plain `insert` rather than an `upsert` targeting that constraint, a second submission attempt either fails (and the UI may be swallowing the error, leaving stale data displayed with no feedback) or something else is silently going wrong. Diagnose the actual current behavior before assuming which.
2. **There's likely no admin path to view or fix a duo submission at all.** Brief 6 deferred "duo submission review" to Brief 7; Brief 7 built the captain-facing `/duos` screen but, as far as this project's history shows, never built an admin-side view or override. Per PRODUCT_SPEC §3 (admin has total control — "edit any... matchup"), this is a real gap, not an intentional restriction — a commissioner needs to be able to see and correct a bad or stuck duo submission, the same way corrections work for scores.

Grounding: `BRIEF_7_M3_REALTIME_LIVE_FEATURES.md` Part B (the original duo submission spec — blind, one row per team per round, captain-authored), `BRIEF_12_PIN_MODAL_DUO_SELECTION.md` (the UI that was just fixed for *building* a lineup — this brief is about what happens on *submit*, a different layer), `ARCHITECTURE.md` §3 (store-raw-derive — a stale display should never survive a genuine database correction; if it does, that's its own bug on top of whatever caused the stale write).

---

## Scope — Part A: Diagnose the write path

- Find the actual code that writes a captain's duo submission (`/duos`, the commit action). Confirm: is it `insert`, or `upsert` targeting `(round_id, team_id)`?
- If it's a plain insert: confirm what happens on a second submission attempt for the same team/round — does it error, and if so, is that error surfaced to the captain or silently swallowed? This is likely the root cause.
- Separately, confirm whether `/duos` (and anywhere else duo picks are displayed — the scorecard header, wherever else) correctly refetches/subscribes to `duo_submissions` changes (Brief 7 wired realtime on this table) — rule out a pure display-staleness issue as a secondary or alternate cause.

## Scope — Part B: Fix the write path

- Correct the write to properly **upsert** on `(round_id, team_id)` — a re-submission should replace the team's prior picks for that round entirely, not conflict or silently no-op.
- If there's a product-level question here (should a captain be able to freely resubmit before the deadline, or should resubmission be blocked once committed?) — per Rulebook v1.6 §4, captains **can** reshuffle duos between rounds, but within a single round's submission, re-submission behavior before the reveal isn't explicitly spec'd. Default to **allowing resubmission up until both teams have committed and revealed** (consistent with "not hard-blocked" deadline philosophy from Brief 7) — once revealed, further changes should go through admin (Part C), not a captain silently overwriting a revealed lineup. Note this assumption in the addendum for Chris to confirm/override.
- Ensure any write failure is **never silent** — a clear error surfaces to the captain if something goes wrong (same principle as the M1 scorecard's write-feedback fix).

## Scope — Part C: Admin — view, set, and reset duo submissions

Per PRODUCT_SPEC §3, admin has total control over the weekend — that has to include duos, not just a reset button. Add to `/admin`:

- A view of each round's duo submissions per team — who's in Duo A, who's in Duo B, committed or not, for every team/round. This is read visibility Chris currently doesn't have at all.
- **Direct set/edit:** Chris can assign or change any team's Duo A / Duo B lineup for any round directly from admin — same underlying write as a captain's submission (Part B's fixed upsert), just triggered from `/admin` instead of `/duos`. Reuse Brief 12's slot-picker UI/pattern if practical rather than building a second one from scratch.
- **Blind-mechanic exception, by design:** an admin-set lineup is a commissioner override — it does not need to respect the "hidden until both teams commit" blind rule the way a captain's own submission does, since Chris legitimately needs to see and set both teams' lineups if a captain's unavailable, a phone dies, or a fix is needed mid-round. This is an intentional, explicit exception to the blind rule for the commissioner only — document it as such, not as a bug.
- A **reset** action remains useful alongside direct-set: clear a team's submission back to "not yet submitted" so the captain can take over again cleanly, if Chris would rather hand it back than keep managing it himself.
- Consistent with Brief 9's delete/edit patterns: confirm before destructive action (reset), no silent write failures (set/edit).

---

## Verification

1. As a captain (real session, since this specifically needs live behavior — or via the same throwaway-local-QA-then-delete technique from Brief 12 if a real session isn't practical), submit a duo lineup, then submit a *different* lineup for the same team/round before reveal — confirm the second submission replaces the first, doesn't error, and displays correctly on reload.
2. From `/admin`, view a round's duo submissions across all teams; directly set/change a team's Duo A/B lineup and confirm it saves and displays correctly; separately, reset a team's submission and confirm it returns to "not yet submitted."
3. Confirm the specific bug Chris hit is resolved: stale players no longer persist after a legitimate correction (via captain resubmission or admin reset).
4. No regression: the blind-reveal mechanic still holds (resubmission before both-committed doesn't leak picks early); Brief 12's slot-picker UI still works on top of this fixed write path; engine tests still green.

## Close-out

Session addendum (shipped / commits / deviations / open issues — especially the resubmission-before-reveal assumption from Part B, flagged for Chris to confirm), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md`.
