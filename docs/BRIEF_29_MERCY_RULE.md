# BRIEF 29 — THE MERCY RULE (QUADRUPLE BOGEY CAP)

**Project:** The GUI Invitational app · **Type:** new rule + feature, punch-list item · **Issued:** Jul 26, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 28 shipped (Rulebook content expansion) — if Brief 28 hasn't run yet, this brief can proceed independently; just don't let the two Rulebook edits conflict (see Part E).
**Gate:** a scorekeeper can mark a player's hole as "mercy" and the gross score is capped at that hole's par + 4 — reflected correctly and automatically in the match, skins, and individual race, with zero new engine logic required.

---

## Context (read once)

Chris wants a mercy rule: if a player isn't going to finish a hole (calls it, or physically picks up), the worst that hole can cost him is a **quadruple bogey, gross** — hole's par plus 4 strokes. A par 4 caps at 8; a par 5 caps at 9; a par 3 caps at 7.

**Why this needs no new engine logic:** every downstream consumer (duo match state, gross skins, the individual net race) already reads whatever raw `strokes` value is on record for a hole — they don't care *why* that number is what it is. Capping the number at **entry time** (when the scorekeeper marks mercy) means match state, skins, and individual race all handle it correctly automatically: a mercy score simply won't be the lowest in a skins comparison, and a duo's best-net-ball logic already picks the partner's real score if he has one. This is meaningfully simpler than the reverse mulligan, which needed a genuine two-score split — mercy is just one number, capped once, consistent everywhere.

**Assumptions made explicit (confirm/override if wrong):**
1. **Opt-in, not automatic.** A player who actually finishes a hole can post a real score higher than par+4 if he wants to — mercy is an available option, not a hard ceiling on every entry.
2. **One flag, not two.** "Calls mercy" and "picks up" are two triggers for the same outcome — a single toggle, not two separate mechanisms.
3. **No stroke-count floor.** The app doesn't police how many strokes someone's taken before mercy is allowed — that's an honor-system matter between the guys, not a validation rule.

Grounding: `hole_scores` schema (already has `breakfast_ball`/`mulligan` boolean flags — this brief adds a third, following the identical pattern), `course_tees.par_by_hole` (already exists since Brief 3 — the par value this brief caps against), `BRIEF_9_ADMIN_UX_HARDENING.md` Part E / `BRIEF_20_ADMIN_CORRECTIONS_REORG.md` (the existing do-over-flag UI/admin patterns to extend, not reinvent).

---

## Scope — Part A: Schema

- Migration: add `mercy_called boolean not null default false` to `hole_scores`, following the exact pattern of the existing `breakfast_ball`/`mulligan` columns.

## Scope — Part B: Confirm no engine change is needed

- Diagnose first, don't assume: confirm that `strokes` is genuinely the single value consumed by match state, `computeSkins()`, and the individual race — if so, capping the entered value at par+4 when mercy is toggled requires no changes to any engine function. Report this confirmation explicitly rather than skipping the check.

## Scope — Part C: Scorecard UI

- Add a **Mercy** toggle/chip per player per hole on the scorecard, styled consistently with the existing "BB AVAIL" / "MULL AVAIL" chips (per Brief 27's shared text scale).
- Toggling it on auto-sets the stroke entry to that hole's `par + 4` (using `course_tees.par_by_hole` for the specific hole). The scorekeeper can still adjust the number afterward with the normal steppers if needed (nothing should be permanently locked) — but the mercy flag stays recorded regardless.
- Show a clear "MERCY CALLED" style badge once toggled, consistent with the existing "MULL USED ON [hole]" badge pattern.
- Unlike breakfast ball/mulligan (once-per-round), mercy has no per-round usage limit — it can be called on any hole, any number of times, by any player.

## Scope — Part D: Admin Corrections

- Extend Brief 20's Corrections drill-down to show and allow toggling the mercy flag alongside the existing gross/net and do-over fields, for the same reason those are editable there — a scorekeeper might mis-mark it live, and Chris needs the ability to fix it after the fact.

## Scope — Part E: Rulebook addition

Add a new short section to `/rulebook`, positioned after "DO-OVERS" — use this copy:

**CALLING MERCY**

Some holes just aren't happening. If you're not going to finish — you pick up, or you just call it — the most that hole can cost you is a quadruple bogey, gross. Par 4 hole, worst case an 8 goes on the card. Par 5, worst case a 9.

You don't have to use it. If you'd rather keep hacking away and post whatever you actually make, that's fine too. Mercy's just there so one disaster hole doesn't wreck your whole day — or hold up the group behind you.

**If Brief 28 has already run** by the time this brief executes, insert this as a new collapsible section in the existing structure. **If Brief 28 hasn't run yet**, this section should still be added now — Brief 28's own scope doesn't touch this section, so there's no real conflict either way, just confirm the final screen has both Brief 28's expanded sections and this new one, not one overwriting the other.

---

## Verification

1. Confirm Part B's diagnosis: no engine function needed changes.
2. Mark a player's hole as mercy on the scorecard — confirm the score auto-sets to that hole's par + 4, badge displays correctly.
3. Confirm the mercy score flows correctly downstream: it doesn't win a skins comparison it shouldn't, and duo match state correctly uses the partner's better score if applicable.
4. Admin Corrections can view/edit the mercy flag for any hole.
5. `/rulebook` shows the new "Calling Mercy" section, correctly placed, without disrupting Brief 28's content.
6. No regression: all engine tests still green (should be unaffected per Part B); existing do-over toggles and badges unaffected.

## Close-out

Session addendum (shipped / commits / deviations / open issues — especially confirming the three stated assumptions in Context matched what was actually wanted), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md`.
