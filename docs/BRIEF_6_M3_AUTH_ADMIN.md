# BRIEF 6 — M3 PART 1: AUTH FOUNDATION + ADMIN PANEL

**Project:** The GUI Invitational app · **Milestone:** toward M3 (part 1 of 3) · **Issued:** Jul 21, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** M2 closed (full scoring engine complete and proven — 77 tests + hand audit).
**Gate:** Chris picks his name from the roster on his phone, sets a PIN, and stays recognized on reload/reopen. Separately, Chris unlocks the admin panel with a passcode and successfully edits a team, a handicap index, and corrects a hole score — each correction ripples through the engine correctly (the store-raw-derive-everything payoff, proven for real).

---

## Context (read once)

M2 proved the engine is correct. **M3 makes the app usable by 16 actual people**, and that starts with knowing *who's* using it. Duo submissions need a captain's identity. Skins opt-in needs a player's identity. The Challenge Ledger needs both parties' identities. None of M3's later briefs (realtime live screens, schedule, champions wall) make sense without this brief first — **auth is the foundation the rest of M3 sits on.**

This brief also closes two items flagged since Brief 4/5 as must-do-before-M3:
1. Revoke the interim anon-write policy on `hole_scores` (opened in migration 0010, pre-auth, so the M1 scorecard could write without a login).
2. Add `unique(team_id, round_id)` on `reverse_mulligans` — nothing currently stops a team from recording two RM events in one round.

Both are cheap now and dangerous to forget once real writes are flowing. Do them first, before building anything new on top.

Grounding: `ARCHITECTURE.md` §2 (the access model — read it, this brief builds exactly that, not something fancier), `PRODUCT_SPEC.md` §3 (admin scope), `TESTING_AND_HARDENING.md` (Layer 4 — the commissioner-correction drills this brief must make possible).

---

## Scope — Part A: Close the two carried-forward items (do this first)

1. **`reverse_mulligans` constraint.** New migration: `alter table reverse_mulligans add constraint reverse_mulligans_one_per_team_round unique (team_id, round_id);`. Confirm it rejects a second insert for the same team+round.
2. **Revoke interim `hole_scores` anon-write.** Drop the migration-0010 policies (`anon can insert/update hole_scores`). They get replaced in Part C below with policies scoped to an authenticated player writing only their own scores (or an admin key). Do not leave the table unwritable in between — land the new policies in the same migration pass as the drop, verified before moving on.

## Scope — Part B: Player access (the PIN model)

Build exactly what ARCHITECTURE §2 specifies — no accounts, no email, no password reset flows.

- **Landing flow:** the shared link opens to a name-picker pulling the live `players` roster (already exists). Player taps their name.
- **First time:** prompted to set a **4-digit PIN**. Store it hashed (not plaintext) in a new `player_auth` table (`player_id`, `pin_hash`, `created_at`). Simple hash is fine (bcrypt or equivalent) — the threat model is friendly pranks, not attackers; don't over-engineer this.
- **Returning:** device remembers the player (a signed session token / cookie, reasonable expiry — e.g. don't force re-entry every session, but don't make it permanent-forever either; a few weeks is fine given the trip is months out). If the device forgets, re-enter name + PIN.
- **Wrong PIN:** clear error, retry. No lockout complexity needed for 16 friends.
- **Session identity flows through the app:** whatever mechanism you use (cookie, local token) must let the app know "this request is player X" for Part C's row-level security and for later briefs (duo submissions, skins opt-in) to attribute actions correctly.

## Scope — Part C: Data write policy (RLS, now identity-aware)

This is where Part A's revoked policy gets properly replaced.

- **`hole_scores` writes:** a player can insert/update their own rows only for holes in a round they're assigned to (via `duo_submissions` / `matches`). If exact "assigned to this round" scoping is complex to express in RLS at this stage, a defensible interim is: any authenticated player can write `hole_scores` rows (since scorekeeping is often one person entering for the whole foursome) — but writes must be tied to a real, authenticated player identity, not anonymous. Document whichever choice you make and why.
- **Admin writes:** a separate mechanism (see Part D) that can write to any table, for corrections.
- Keep `SELECT` open (anon-read) as it's been since M0 — reading standings/scores doesn't need auth, only writing does.

## Scope — Part D: Admin panel (Chris only)

A separate, passcode-gated area. Not fancy — this is a tool for one person, not a polished multi-user surface.

- **Admin passcode:** a single shared secret (env var or a simple `admin_auth` check), unlocking an `/admin` route on Chris's devices. Not per-device-remembered the same casual way as player PINs — require the passcode each session, or at least don't make it trivially guessable via the player flow.
- **Admin capabilities, this brief:**
  - **Teams:** create/edit the four teams, assign captain, add/remove `team_members`. (Draft happens offline per the Rulebook — this is where Chris enters the results after.)
  - **Matchups:** set which team plays which each round (`matches` table).
  - **Indexes:** edit any player's `index` (GHIN or trip-assigned).
  - **Course setups:** create/edit `courses` + `course_tees` (rating, slope, par, stroke index, par/yardage by hole) — this is what lets Chris load the real trip courses when they're locked, replacing the M1 demo course.
  - **Corrections:** edit any existing `hole_scores` row directly. This is the big one — **prove the architecture**: change a score, reload the scorecard or standings view, confirm match state / skins / individual race all recompute correctly downstream. No stale data anywhere.
  - **Absence handling:** mark a player absent for a round (however this is cleanest given the count-agnostic schema from Brief 2 — likely just means: don't require them in a duo, don't crash if their `hole_scores` are simply absent).
- **Explicitly deferred to Brief 7:** skins opt-in toggle, Challenge Ledger admin resolve/void, blind duo submission review — those admin surfaces ship with the features they administer, in the next brief.

---

## Verification (the M3-Part-1 gate)

1. Migration confirms: `reverse_mulligans` rejects a duplicate team+round insert.
2. `hole_scores` interim anon-write policy is gone; new identity-scoped policy verified (an authenticated player can write, confirm what an unauthenticated request now gets — should fail cleanly, not silently).
3. On Chris's **phone**: open the link, pick "Chris Deliso," set a PIN, close the browser, reopen — still recognized. Log out (or clear session) and log back in with the PIN.
4. On Chris's phone or desktop: enter the admin passcode, reach `/admin`. Edit a team's roster, add a matchup, change a player's index, and — the key one — **edit an existing hole score and confirm the M1 scorecard (or wherever match state renders) reflects the corrected value** without a redeploy.
5. No regression: M1 scorecard still functions for a signed-in player; all 77+ engine tests still green; `/engine` isolation intact.

## Deferred to Brief 7 (M3 part 2 — do NOT build here)

Realtime subscriptions (multi-device live updates) · blind duo submission UI + simultaneous-reveal logic · skins opt-in toggle · the Challenge Ledger UI · reverse-mulligan calling UI in the scorekeeper flow (the engine logic exists from Brief 4; the *button* comes here). This brief is identity and admin only.

## Deferred to Brief 8 (M3 part 3)

Schedule/itinerary screen · champions wall.

## Close-out

Session addendum (shipped / commits / deviations / open issues), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md`. Flag anything about the auth approach that should be hardened before real trip data loads (this is a friends-trip threat model, not a bank — note explicitly what was intentionally kept simple).
