# BRIEF 22 — FIX: SKINS OPT-IN CUTOFF SHOULD BE THE MATCH'S OWN TEE TIME

**Project:** The GUI Invitational app · **Type:** small fix, punch-list item · **Issued:** Jul 26, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 21 shipped (skins cross-round carryover, leaderboard toggle fix).
**Gate:** a player's skins opt-in cutoff reflects their own match's actual tee time exactly — not 30 minutes early, and not the round's overall earliest tee time if that differs from their own foursome's.

---

## Context (read once)

Chris flagged that skins opt-in currently cuts off 30 minutes before the tee time — he wants it to cut off exactly **at** the match's start, no early buffer. The 30-minute-early pattern makes sense for duo submissions (Brief 17) — captains need lead time to decide lineups before tee-off. It doesn't make sense for skins: a player can reasonably decide "I'm in" right up until he's standing on the tee, so there's no strategic reason to close it early.

**Diagnose first, don't assume the current mechanism.** It's likely skins opt-in currently reuses the same deadline computation duo submissions use (round's earliest tee time, minus 30 minutes) — but confirm this against the actual code before changing it, per house practice.

**A likely additional correction, not just a timing tweak:** duo submissions' deadline is computed from the *round's earliest tee time across all four matches*, which makes sense for duos (all four captains are working against the same round-wide clock). Skins opt-in is a **per-player** decision, and each player belongs to a specific match with (since Brief 17) its own assignable `tee_time`. The more correct fix is likely: skins cutoff = **that specific player's own match's tee time**, not the round's overall earliest tee across all matches. If two foursomes tee off at different times, a player in the later group shouldn't be artificially cut off early just because another group tees off sooner. Confirm this interpretation makes sense once you see the current code; flag if it should instead just be "the round's tee time, no offset" if that's a simpler and equally correct reading of what Chris wants — note the choice made in the addendum either way.

Grounding: `BRIEF_17_TEE_TIME_SLOTTING.md` (the tee-time model this reads from — `matches.tee_time`, one per matchup), `BRIEF_7_M3_REALTIME_LIVE_FEATURES.md` Part C (original skins opt-in spec — "lock opt-in after the round's first tee... not hard-blocked, surfaced").

---

## Scope

- Find the current skins opt-in cutoff logic/display on `/money`. Confirm what it currently computes (likely a reused/adapted version of the duo deadline calculation).
- Change it to compute from the **signed-in player's own match's `tee_time`** — no minus-30 offset. If that player isn't yet assigned to a match for the round, or the match has no tee time set, fall back gracefully (same "not hard-blocked, just informative" philosophy already used elsewhere — never a broken or missing state).
- Keep the existing "not hard-blocked" behavior — this changes what time is *displayed/considered the cutoff*, not whether opt-in is forcibly disabled after it (unless that enforcement already exists elsewhere and should stay consistent — confirm current behavior, don't change enforcement strictness as a side effect of this fix).

---

## Verification

1. Confirm the diagnosis: report what the current skins cutoff computation actually does before changing it.
2. After the fix: a player's skins screen shows their cutoff as their own match's tee time, not 30 minutes earlier, and not a different match's time.
3. Two players in different matches (different tee times) within the same round see correctly different cutoff times reflecting their own match.
4. Graceful fallback confirmed if a match has no tee time set.
5. No regression: duo submission's own 30-minutes-early deadline (a different, intentionally-kept behavior) is unaffected; all engine tests green; Brief 21's skins carryover and leaderboard toggle fix unaffected.

## Close-out

Short session addendum, to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` — closes this item from the punch list.
