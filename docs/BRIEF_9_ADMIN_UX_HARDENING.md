# BRIEF 9 — ADMIN & UX HARDENING

**Project:** The GUI Invitational app · **Type:** internal hardening, not a milestone · **Issued:** Jul 22, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** M3 fully built (Briefs 6, 7, 7.5, 8 shipped).
**Gate:** Chris can freely manage (delete/rename) demo and test data from `/admin` with clear confirmation on anything destructive; a removed reverse mulligan actually disappears from the scorecard; core screens are easier to navigate one-handed; skins opt-in is a deliberate, one-way commitment per round.

---

## Context (read once)

This is not a milestone brief — it's a punch-list/hardening pass surfaced entirely from Chris actually living in the admin panel and the app this week. None of this is player-facing polish for the trip yet ("this is not ready to show anyone yet" — Chris's words); it's about making the tool usable for *him* as he builds out real trip data and keeps testing. Treat every item as real, reported friction, not speculation.

Grounding: `ARCHITECTURE.md` §3 (store-raw-derive-everything — several of these fixes are really "does a deletion/removal correctly propagate to derived state" bugs), `PRODUCT_SPEC.md` §2 (reverse mulligan two-score rule — Part E below), `BRIEF_6_M3_AUTH_ADMIN.md` / `BRIEF_7_M3_REALTIME_LIVE_FEATURES.md` (what admin and the scorecard currently do — read before changing, don't rebuild what's not broken).

---

## Scope — Part A: Admin delete capability (teams, rounds, matches, courses, challenge bets)

Right now `/admin` supports create/edit but not delete on these. Add delete, with dependency-aware confirmation — this data is currently mostly demo/test data Chris wants to clear out, but the same delete capability will exist once real trip data is loaded, so build it safely from the start:

- **Before deleting**, check for dependent rows (e.g., deleting a course checks for rounds that reference it; deleting a round checks for matches, hole_scores, duo_submissions, skins_entries that reference it; deleting a team checks for team_members, matches, duo_submissions).
- **If dependents exist**, show a clear confirmation that states what will also be deleted (e.g., "Deleting this course will also delete 1 round, 4 matches, and 72 hole scores. This cannot be undone. Continue?") and cascade the delete on confirm. If no dependents, a simpler confirm is fine.
- **If dependents exist and cascading feels too risky to build safely in this brief** (e.g., a genuinely deep dependency chain), a defensible fallback is: block the delete and tell Chris exactly what to remove first, in order. Use judgment — prefer cascade with a clear warning if it's straightforward; don't over-engineer.
- Apply to: `courses` (+ `course_tees`), `rounds`, `teams`, `matches`, `challenge_bets`. (Duo submissions and skins entries can be left as edit-only for now unless trivially covered by the same pattern.)

## Scope — Part B: Round naming/display by course, not just date

- Wherever rounds are listed or referenced (admin, scorecard header, anywhere else), display them by **course name + format** (e.g., "Cottonwood Hills — Shamble") rather than just a raw date. Date can still show alongside, just not as the primary label.
- This is a display change — no schema change needed, `rounds.course_id` already joins to `courses.name`.

## Scope — Part C: Home page navigation — bigger, moved to top

- The main action buttons on the home/landing page (Score a round, Duos, Money, Schedule, Champions, whatever the current set is) need to be **larger tap targets** and positioned **near the top** of the page, not buried below the roster or other content.
- Follow the mockup's general sizing/spacing language (`gui_invitational_mockup.html`) for what "big enough for a phone in sunlight, one-handed" looks like — reuse those proportions rather than guessing new ones.

## Scope — Part D: Player-facing back buttons + roster nav — bigger

- The back/home navigation added in Brief 7.5, and the roster view/link, need larger touch targets. Same standard as Part C — this is a phone-in-hand, mid-round usability bar, not a desktop-density one.

## Scope — Part E: Fix — removed reverse mulligan still shows on scorecard

**Diagnose first, don't guess-fix.** Likely root cause: calling a reverse mulligan writes both a `reverse_mulligans` row (the event) and sets `hole_scores.match_strokes` on the affected hole (the two-score divergence, per the Brief 4 two-score rule). If admin's removal only deletes the `reverse_mulligans` row without clearing the associated `match_strokes` back to `null`, the scorecard keeps reading the stale diverged value forever — the event is gone but its effect on the hole isn't undone.

- Confirm this is the actual mechanism (check what admin's current "remove RM" action does, and what the scorecard reads).
- Fix so that removing/undoing a reverse mulligan **also clears `match_strokes`** on the hole(s) it affected, restoring the hole to reading `strokes` for match purposes too — i.e., fully undoing the RM's effect, not just its record of having happened.
- This closes the "reverse mulligan correction/undo" item that's been on the punch list since Brief 7.

## Scope — Part F: Scorecard — clear round/course context

- The scorecard currently doesn't make it obvious which round and course a player is looking at. Add a clear header/label: course name, round format (Shamble/Four-ball), and ideally the date — visible at the top of the scorecard, not just inferable from context.
- If `/score` is scoring multiple rounds (or will be, once the match-picker gap from Brief 7's addendum is eventually closed), this context becomes essential — build it now regardless of whether multi-round selection exists yet.

## Scope — Part G: Skins opt-in — confirm, then lock

Per SPEC §2: opt-in should be a deliberate act, not a casual toggle.

- **On opting in:** show a confirmation step before writing the `skins_entries` row — plain language, e.g., "Opt into gross skins for [round]? Once you're in, you can't opt back out this round." Require an explicit confirm tap, not just a toggle flip.
- **After opting in:** remove or disable the ability to opt back out for that round from the player-facing UI. This is a one-way door for players.
- **Admin retains override:** if a genuine mistake needs correcting (wrong player opted in, etc.), that's an admin action, not a player one — confirm `/admin` can still remove a `skins_entries` row if needed (add this admin capability if it doesn't already exist, small addition).

---

## Verification

1. Delete a course/round/team/match/challenge bet with dependents from `/admin` — confirmation correctly lists what will be removed, cascade works, no orphaned rows left behind.
2. Rounds display by course name + format everywhere they're referenced.
3. Home page primary actions are bigger and near the top; verify on a real phone.
4. Back/roster navigation targets are bigger; verify on a real phone.
5. Call a reverse mulligan, confirm the two-score divergence appears on the scorecard, then remove it from admin — confirm the scorecard now shows the single, undivided score again (not the stale replay value).
6. Scorecard clearly shows which round/course is being scored.
7. Attempt skins opt-in as a player — confirmation appears, then the opt-out option is gone/disabled after confirming. Admin can still remove the entry if needed.
8. No regression: all existing engine tests green; `/engine` isolation intact; nothing from Briefs 6–8 broken.

## Close-out

Session addendum (shipped / commits / deviations / open issues), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md`. If the delete-cascade logic surfaced any schema decisions worth recording (e.g., foreign key behavior), note them.
