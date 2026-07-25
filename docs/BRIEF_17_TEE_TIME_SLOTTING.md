# BRIEF 17 — TEE TIME SLOTTING

**Project:** The GUI Invitational app · **Type:** new capability, punch-list item · **Issued:** Jul 23, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 16 shipped (leaderboard display fix, commit `2bb899a`).
**Gate:** Chris can assign a real tee time to each of a round's four matchups from `/admin`; players see their own match's tee time clearly (scorecard header); the duo submission deadline reflects the round's actual earliest tee time instead of a generic date-only placeholder.

---

## Context (read once)

Chris wants the four foursomes in a round slotted into explicit tee times — "Tee time #1, tee time 2... etc to 4." Right now `matches` has no time concept at all; the duo submissions screen already *references* "the round's first tee" in its deadline text, but that's currently just the round's date, a placeholder standing in for data that doesn't exist yet.

**A side note, not required scope:** per Rulebook v1.6, round format is fixed by day — shamble is always Saturday, four-ball is always Sunday. This means "which round is Saturday vs Sunday" (the reason Brief 14 skipped its optional Sunday-pairings-preview) is actually already derivable from `rounds.format`, no new schema needed. Mention this in the addendum as newly-unblocked; only act on it if genuinely trivial alongside this brief's real scope — don't force it in.

Grounding: `gui_invitational_mockup.html` Schedule screen (`scr-sched` — shows the exact pattern: "9:00 AM — G1: ...", "9:10 AM — G2: ...", etc., one line per foursome), `BRIEF_8_M3_SCHEDULE_CHAMPIONS.md` (the existing `/schedule` screen and `schedule_items` table — tee times are schedule-adjacent content), `BRIEF_9_ADMIN_UX_HARDENING.md` Part D / Brief 15 Part D (the per-round admin card layout — tee time assignment nests naturally here), `BRIEF_9...` Part F (scorecard header — extend it).

---

## Scope — Part A: Add tee time to matches

- Migration: add `tee_time timestamptz null` to `matches`. A single timestamp per matchup covers both "what time" and "what order" (sort ascending) — no separate ordering field needed.
- Nullable — most matches won't have one until Chris assigns it; nothing should break for a match with no tee time set (just don't display one).

## Scope — Part B: Admin — assign tee times

- In `/admin`'s Rounds & Matchups (now organized per-round per Brief 15 Part D), add a tee-time field to each matchup row — a simple time input, nested in that round's card alongside the existing team A / team B / slot controls.
- Save/clear per matchup, consistent with the existing save pattern for that screen.

## Scope — Part C: Surface tee times to players

- **Scorecard header** (Brief 9 Part F already shows course/format/date): add the match's own tee time if set.
- **Duo submissions deadline:** replace the current generic "30 minutes before [round date]'s first tee" text with a real computed deadline — the **earliest** `tee_time` among that round's four matches, minus 30 minutes. If no tee times are set yet for the round, fall back to the current generic date-based text (graceful degradation, not a broken state).
- **Schedule screen (`/schedule`):** surface the round's four tee times as a clear list, per the mockup's pattern (time + matchup/group identifier), either merged chronologically with other `schedule_items` for that day or as a clearly labeled adjacent section — use judgment on the cleanest integration, but they must be visible somewhere on Schedule, not just buried in admin.

---

## Verification

1. Admin can set and clear a tee time on any matchup within a round's card.
2. A match with a tee time set shows it on that match's scorecard header; a match without one shows no broken/empty artifact.
3. Duo submissions deadline text reflects the real earliest tee time once set; falls back gracefully if unset.
4. `/schedule` shows the round's tee times clearly, one per foursome.
5. No regression: existing admin round cards, scorecard, duo submissions, and schedule screens all still function; engine tests still green (this is UI/schema only, no engine change expected).

## Close-out

Session addendum (shipped / commits / deviations / open issues — including the Saturday/Sunday-via-format note for future reference), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` — closes the tee-time item from the punch list.
