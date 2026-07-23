# BRIEF 8 — M3 PART 3: SCHEDULE + CHAMPIONS WALL

**Project:** The GUI Invitational app · **Milestone:** M3 (part 3 of 3 — closes M3) · **Issued:** Jul 22, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 7 code-complete (live gate verification can happen independently/later — not a dependency for this brief).
**Gate:** Chris can view the trip schedule on his phone, and — via `/admin` — add/edit a schedule item and see it reflected live. The champions wall renders (with placeholder "Year One — in progress" state, since there's no history yet) and is structured to hold real results after Mar 28, 2027.

---

## Context (read once)

This is the last brief of M3, and it's deliberately the lightest. Everything since Brief 6 has been high-stakes: auth, corrections, realtime, money logic. Schedule and champions wall are **content screens** — informational, low-complexity, no new engine logic, nothing that risks the scoring integrity already proven at M2. Treat this brief as a cool-down, not a corner to cut on quality — these screens are what a player opens ten times a day for "what time do we tee off" and what everyone gathers around after the trophy's handed out.

Grounding: `PRODUCT_SPEC.md` §3 ("Beyond scoring" — schedule and champions wall, both canonical here), `GUI_INVITATIONAL_RULEBOOK.md` §1 (the weekend's actual shape — fun round Friday, draft night, Saturday shamble, Sunday four-ball), `gui_invitational_mockup.html` (Schedule and Champions Wall screens — this brief makes those real), `ARCHITECTURE.md` §5 (`schedule_items` table already exists and stubbed since Brief 2).

---

## Scope — Part A: Schedule / itinerary screen

- A read screen, reachable from the app's main nav, listing schedule items chronologically: tee times, dinners, the Friday fun round, draft night, anything Chris adds. Pull from `schedule_items` (already in the schema since Brief 2, unused until now).
- Group/display by day (Friday / Saturday / Sunday) per the mockup's Schedule screen pattern — time, title, optional notes.
- **This is where the `first_tee_at` gap (flagged in Brief 7's addendum) can close**, if convenient: a schedule item with a time attached is a natural home for "first tee" data that the duo-submission deadline countdown could eventually read from. Not required this brief, but note whether it's a natural fit or a separate concern — don't force it if it complicates scope.
- No player-facing editing — this is admin-authored content, players just view it.

## Scope — Part B: Admin — manage schedule items

- In `/admin`, add create/edit/delete for `schedule_items`: title, day/time, optional notes. This is the only way schedule content gets in — no seed data required beyond maybe one or two real items if Chris wants to test with something concrete (e.g., "Fri 2:00 PM — Fun round," "Fri 8:00 PM — Draft Night").
- Confirm the store-raw-derive pattern holds here too, though it's simpler than scores: add/edit an item in admin, confirm it appears on the schedule screen without a redeploy (realtime or a simple refetch — this content changes rarely, so a full realtime subscription isn't required, but the existing `useRealtimeRefetch` hook from Brief 7 can be reused if it's a trivial addition).

## Scope — Part C: Champions wall

- A screen, reachable from main nav, structured around **seasons** (the `seasons` table has existed since Brief 2 — Year One / 2027 is already seeded).
- Per season: display the cup winner (team + players), the individual net champion, and — new, small addition — the season's skins/Challenge Ledger leader if that's a natural thing to surface (optional; don't overbuild, check the mockup for what it actually shows).
- **Right now there's no completed season**, so this screen needs a clean **"Year One — in progress"** or equivalent placeholder state per the mockup, rather than showing broken/empty data. This is not a bug to fix later — it's the correct state for a trip that hasn't happened yet.
- Data model: results get written here by admin after the trip concludes (a "close out the season" admin action is a reasonable scope for *this* brief if simple — record the cup winner, individual champion, chip-off results if any — but the actual population of Year One's results happens for real on Mar 28, 2027, not now). Keep this lightweight; don't build elaborate season-closing ceremony logic for a trip that's 8 months out.
- Multi-year structure should already fall out of the existing `seasons` table — confirm the screen is written to loop over seasons (even though there's only one right now) rather than hardcoding "Year One," so Year Two in 2028 is just a new season row, not new code.

---

## Verification

1. Schedule screen renders on Chris's phone, grouped by day, pulling from `schedule_items`.
2. Admin can add/edit/delete a schedule item; it appears on the schedule screen without a redeploy.
3. Champions wall renders with the correct "in progress" placeholder for Year One.
4. Champions wall is structured to loop over `seasons` (confirm by eye or a quick code check — not literally testing with a second season).
5. No regression: all existing screens (`/score`, `/duos`, `/money`, `/admin`) still function; engine tests still green.

## Out of scope (do not build here)

Anything related to the live two-device gate from Brief 7 (separate, independent verification). Anything from the punch list not explicitly scoped above (PIN reset, nav dead-ends — see Brief 7.5 if issued separately). Elaborate season-closing ceremonies or historical stat aggregation beyond what's listed in Part C — this is Year One, there's no history yet to aggregate.

## After this brief

**M3 is closed** — the entire live app is feature-complete: scoring, auth/admin, realtime, duos, skins, the Challenge Ledger, reverse mulligans, schedule, and champions wall. Per BUILD_PLAN, next is **M4 — the dress rehearsal**: one fully simulated trip day with 3+ humans on their own phones, admin setup through settle-up, end to end, on production infrastructure. That's also the natural home for the UX/polish pass flagged in earlier sessions — real multi-human usage is what should drive that work, not guesses made now.

## Close-out

Session addendum (shipped / commits / deviations / open issues), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` to reflect M3 as fully closed (pending the Brief 7 live gate verification, which can close independently).
