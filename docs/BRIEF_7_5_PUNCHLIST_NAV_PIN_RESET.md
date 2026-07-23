# BRIEF 7.5 — PUNCH-LIST FIXES: NAVIGATION + PIN RESET

**Project:** The GUI Invitational app · **Type:** small fix brief, not a milestone · **Issued:** Jul 22, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 7 code-complete (migrations 0017–0019 run; live gate still pending separately — this brief doesn't touch that).
**Gate:** `/duos` and `/money` both have a clear way back/home from every state; a player who forgot his PIN can be reset from `/admin` and successfully sign in again with a new one.

---

## Context

Two small gaps surfaced from solo poking around the live app, both worth closing now since they're cheap and don't require a second device to build or verify:

1. **No back/redirect navigation on `/duos` or `/money`.** Same *class* of bug as the Brief 6 sign-in dead-end (`092268c`) — a screen with no way out. Not identical severity, but same failure shape: a player lands there and has no obvious path back to the rest of the app.
2. **No admin PIN-reset capability.** Flagged in the Brief 7 addendum and `PROJECT_STATUS.md` as "worth adding before broad live testing" — now's the time, before real players start setting PINs for the live gate test or the trip itself.

This is a small, contained brief — no new engine logic, no schema changes beyond one migration for Part B.

---

## Scope — Part A: Navigation on `/duos` and `/money`

- Add a clear way back to the main app (home/roster, or wherever the primary nav lives) from both `/duos` and `/money`, in every state (signed-in, signed-out, mid-flow).
- Match whatever navigation pattern already exists elsewhere in the app (check `/score` and `/admin` for the established back/home convention and reuse it — don't invent a new pattern).
- Quick audit while in there: confirm no other screen has this same gap (a scan of all routes for "how does someone get back to home from here" is worth the five minutes).

## Scope — Part B: Admin PIN reset

- In `/admin`, add a control (likely alongside the existing player/roster admin section) to reset a specific player's PIN: clears their `player_auth` row (or the equivalent), so the next time that player signs in they're treated as first-time and prompted to set a new PIN.
- Consider whether resetting should also clear the `player_devices` link for that player (probably yes — a PIN reset likely means "this player is locked out or the device is lost," so the old device linkage shouldn't silently persist). Use judgment; note the choice in the addendum.
- No new complexity beyond this — no email, no recovery flow, just a commissioner override consistent with the friends-trip threat model (ARCHITECTURE §2).

---

## Verification

1. From `/duos` (signed in and signed out states) and `/money`, confirm a clear path back to the app's home/main nav exists and works.
2. In `/admin`, reset a test player's PIN, then confirm that player's next sign-in attempt prompts to set a new PIN rather than asking for the old one.
3. No regression: existing sign-in/PIN-setting flow (Brief 6) still works for a player who hasn't been reset; all engine tests still green.

## Close-out

Short session addendum (this is a small brief — a few lines is fine), save to Desktop folder and `/docs`, commit and push. Update `PROJECT_STATUS.md` to mark these two punch-list items closed.
