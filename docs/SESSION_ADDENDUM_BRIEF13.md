# Brief 13 — Stale Duo Submissions + Admin Override · Session Addendum

**Date:** July 23, 2026

**Shipped:** the real bug — captains couldn't reach the duo form again once submitted — plus a
full admin duo view/set/reset. Pushed to `main`.

## Part A — Diagnosis: the write path was never the problem

Chris's hypothesis was that `duo_submissions`' write was probably a plain `insert` rather than an
`upsert`. Checked the actual code and data instead of assuming:

- `CaptainForm`'s `commit()` has used `.upsert(..., { onConflict: "round_id, team_id" })` since
  Brief 7 — unchanged by Brief 12's slot-picker rewrite, which only touched *how* the four slots
  get built, not how they're saved.
- The `unique (round_id, team_id)` constraint has existed on `duo_submissions` since migration
  `0006` (Brief 2/3 era) — not something Brief 9's not-yet-run `0021` would affect either way.
- Pulled every row from the live production `duo_submissions` table directly: **exactly one row
  per (round_id, team_id)** across all 4 teams, no duplicates. The upsert target matches a real
  constraint and has been working correctly at the database level the whole time.
- Realtime is wired (`useRealtimeRefetch("duo_submissions", ...)`) and refetches on any change,
  including a raw Supabase dashboard edit — ruled out as a display-staleness cause too.

**The actual bug:** `TeamStatusRow` only ever rendered `CaptainForm` when `submitted === false`.
The instant a team's row existed — even a test submission from weeks ago — the captain's own
screen collapsed to a permanent "submitted, waiting on opponent" dead end, with no path back to
the form. Not a failed write; a UI gap that made a *correct* write unreachable a second time. This
also explains why "fixing it directly in Supabase didn't change what displayed" was so
disorienting: even if a manual edit had propagated correctly, the captain-facing screen never
showed *what* was submitted pre-reveal in the first place — there was no way to visually confirm
anything matched intent.

## Part B — Fix: keep the form reachable, pre-filled, with real feedback

In `app/duos/DuosScreen.tsx`:

- `TeamStatusRow` now shows `CaptainForm` to the captain regardless of whether a submission
  already exists — only non-captain teammates get the static status line. (Once both teams
  commit, `Matchup`'s own `bothCommitted` branch takes over and stops rendering `TeamStatusRow`
  at all, so this never leaks into "editable after reveal" territory — that boundary was already
  structurally enforced and needed no new code.)
- `CaptainForm` takes a new `existingSubmission` prop and seeds its slot state from it
  (`useState(() => ({ A1: existingSubmission?.duoAPlayer1 ?? null, ... }))`), so reopening the
  form shows the real current lineup instead of four blank slots.
- Added a `successMessage` state (mirrors the Scorecard's write-feedback pattern) and changed the
  submit button to read "Update duos" instead of "Commit duos" once a submission exists, so the
  captain gets a clear, honest signal of what just happened either way.

**Assumption flagged for Chris, per the brief's own request:** resubmission is allowed freely up
until both teams commit and reveal (matching the "not hard-blocked" deadline philosophy from
Brief 7) — after reveal, `Matchup` already routes to the read-only `RevealedDuo` view, so
correction at that point is admin-only (Part C) by construction, not by an extra check I had to
add. If Chris wants resubmission blocked earlier (e.g., locked the moment the *other* team
commits, even before mutual reveal), that would need new logic — flagging for him to confirm the
default is right before treating this as fully closed.

## Part C — Admin: view, set, and reset duo submissions

New in `app/admin/actions.ts`: `setDuoSubmission` (same upsert as a captain's own commit, plus a
same-player-in-two-slots guard) and `resetDuoSubmission` (deletes the `(round_id, team_id)` row).
New "Duo submissions" section in `/admin`, scoped by the same round picker used for Corrections:

- Every team's current lineup for the selected round, submitted or not — no blind-reveal
  restriction, by design (a commissioner override, not a bug — documented as such in the code
  comment so it doesn't get "fixed" into matching the captain's blind view later).
- Direct set/edit via four plain `<select>` roster dropdowns (Duo A/B, player 1/2) rather than
  porting Brief 12's tap-to-fill client component: admin's whole page is server-rendered
  forms-and-selects already (Teams, Matchups, Course Tees, Corrections, all of it), and a 4-person
  team roster maps onto four dropdowns at least as clearly as a tap sheet would, without
  introducing the only client-side interactive component on the page. Noting this as a deliberate
  "not practical to reuse" call per the brief's own "if practical" hedge.
- Reset via the existing `ConfirmDeleteButton` pattern, same as every other destructive action
  since Brief 9.

## Verification

Lint, typecheck, build (all 7 routes), and `npm run test` (84/84) all clean.

**Live-verified, no real identity or data touched:**
- Admin's new "Duo submissions" section: logged in with the real admin passcode and confirmed it
  renders live production data correctly — all 4 teams, correct "submitted" status, correct
  pre-filled picks matching what I'd independently queried straight from the database.
- Admin's *write* actions (`setDuoSubmission`/`resetDuoSubmission`): attempted a real
  end-to-end test (create a throwaway "ZZ QA Test Team," exercise set/reset, delete it) and hit
  the same wall Brief 9 already documented — this local dev environment's
  `SUPABASE_SERVICE_ROLE_KEY` has been a placeholder since Brief 6, so every admin *write*,
  not just this brief's new ones, only ever fails cleanly here ("No season exists yet" from the
  season lookup a write path depends on) rather than actually running. Confirmed the failure was
  clean and non-destructive — no test team was left behind (`teams` table still shows exactly the
  real 4). The actual successful write is Chris's to run live, same as every prior admin brief.
- Captain resubmission + prefill (Part B): `CaptainForm` is only reachable signed in as a real
  captain, which this project's standing practice rules out. Verified with the same
  temporary-local-QA-route-then-delete technique as Brief 12 — rendered the real `DuosScreen`
  against fake data with a pre-existing fake submission. Confirmed: the form appears instead of
  the dead-end text, all four slots arrive pre-filled with the existing picks, and the button
  reads "Update duos." Deleted before committing — `git status` shows no trace.

No regression: `bothCommitted`'s gating in `Matchup` is untouched, so the blind-reveal mechanic
holds exactly as before; Brief 12's slot-picker interactions (tap-to-fill, `×` to remove) are
unmodified, just now seeded from real data instead of always blank; engine tests unaffected (no
engine changes this brief).

## Open items carried forward

Unchanged from Brief 12's addendum, plus one new item:
- Chris's live click-through of Brief 12's duo slot picker as a real captain, still pending.
- **New:** confirm the resubmission-before-reveal assumption above is the intended rule.
- Migrations `0020`/`0021` still pending; Brief 7's live two-device gate and Brief 9's own live
  gate still outstanding; no `first_tee_at` field; ARCHITECTURE §5 reconciliation still pending.

## Next

M4 — the dress rehearsal — remains the next real milestone once the outstanding live gates above
are cleared.
