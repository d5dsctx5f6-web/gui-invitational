# BRIEF 15 — FIX: STALE LEADERBOARD DATA + ROUNDS ADMIN CLEANUP

**Project:** The GUI Invitational app · **Type:** bug fix + admin UX cleanup · **Issued:** Jul 23, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 14 shipped (`/leaderboard`, individual race + Cup standings).
**Gate:** the individual race and Cup standings only reflect the intended, current competitive rounds — no leftover demo/test data contributes to live standings; the Rounds & Matchups admin screen is organized per-round instead of one overwhelming flat list.

---

## Context (read once)

Chris's `/leaderboard` individual race correctly shows live, in-progress data for players currently in the GreyHawk round he's actively scoring (Ben Meier, Rory Makohin, Tucker Gill, Chris Deliso — all match the scorecard's running totals exactly, confirmed by hand). But it also shows four players — Spencer Petersen, Dominic Ikeler, Grant Brogan, Ian Hastings — all "thru 18" with large net totals (73, 94, 95, 97), despite no round having actually been completed yet.

**Best-guess root cause:** SPEC §2 specifies the individual race sums exactly the trip's two competitive rounds — but nothing currently enforces that. The very first demo match scored back in Brief 3/M1 ("Cottonwood Hills (Demo)," Chris/CJ Lambrecht/Spencer Petersen/Will Petersen) is likely still sitting in the `rounds`/`hole_scores` tables, months-old and never deleted. Spencer Petersen's presence in the stale data matches that original demo match's roster. **Dominic Ikeler, Grant Brogan, and Ian Hastings are not explained by that same demo match** — their source needs to be found directly, not assumed. Do not guess; query the actual data.

Grounding: `BRIEF_14_LIVE_LEADERBOARD.md` (what the leaderboard currently reads), `BRIEF_9_ADMIN_UX_HARDENING.md` Part A (the delete/cascade capability that's the likely cleanup tool here), `PRODUCT_SPEC.md` §2 ("cumulative individual net across both competitive rounds").

---

## Scope — Part A: Diagnose — find every round in the database and what's in it

- Query and list every row in `rounds`, with: id, date, format, course, and a count of `hole_scores` rows tied to it (and which players).
- For each of Spencer Petersen, Dominic Ikeler, Grant Brogan, and Ian Hastings specifically: find every `hole_scores` row belonging to them, and which `round_id` each belongs to. Confirm exactly which round(s) are producing the stale "thru 18" totals.
- Report findings clearly before fixing anything — Chris needs to see what's actually in the database, not just get a fix applied blind.

## Scope — Part B: Clean up the stale data

- Once the offending round(s) are identified, **delete them** using Brief 9's admin delete/cascade capability (or a direct migration if cleaner) — this should cleanly remove the stale rounds and every dependent row (hole_scores, matches, duo_submissions, etc. via the cascade FKs from migration 0021).
- Confirm after deletion: the leaderboard no longer shows the stale entries, and the real, current GreyHawk round's data is untouched.

## Scope — Part C: A light guardrail against recurrence

This will keep happening as Chris continues testing/iterating unless there's some signal when stray rounds accumulate. Keep this proportionate — not a heavy new architecture, just visibility:

- In `/admin`, surface a clear count of rounds that currently exist (per season), somewhere Chris will actually see it during normal use (e.g., the Rounds & Matchups section already shows the list — a simple "3 rounds exist — SPEC calls for 2 competitive rounds per trip" note if the count exceeds 2 is enough).
- **Do not** build a heavier "official round" flagging system unless Part A's findings make clear it's actually needed (e.g., if Chris has a real reason to keep more than 2 rounds around for ongoing testing while only wanting a subset to count). If that turns out to be the case, flag it back to Chris as a scope decision rather than building it unprompted — the simplest fix (delete stray rounds, stay disciplined about round count) may be entirely sufficient for a 16-person friends trip.

## Scope — Part D: Clean up the Rounds & Matchups admin screen

Independent of the data cleanup above, but done in this same pass since Chris is in this exact screen already. Currently `/admin`'s Rounds & Matchups section is one flat list — every round's buy-in, every matchup row (team A / team B / slot / save / remove), and the add-matchup/add-round controls all stacked together with no grouping. It's overwhelming, especially once more than one or two rounds exist.

Reorganize into **per-round grouped sections** (a card or a clearly bordered block per round), each showing:
- The round's header (course + format + date — the label established in Brief 9 Part B), with its **Delete Round** action clearly placed (top-right of its card, as it is now).
- Its skins buy-in control, scoped visually to that round.
- Its matchups (team A vs team B, slot, save/remove) nested underneath, clearly belonging to that round — not interleaved with another round's matchups.
- Collapse/expand per round is a reasonable addition if multiple rounds are commonly open at once (post-cleanup there should typically be just 1–2 rounds, so don't over-build this — a simple card-per-round layout with normal scrolling may be entirely sufficient; use judgment based on how it looks once Part B's cleanup has run).
- The "Add a round" control stays as a clear, separate action at the bottom, not blended into any round's card.

This is purely a layout/grouping change — no new data, no new capability, just making the existing controls scannable instead of a wall of identical-looking rows. Reuse existing components/styling patterns already established elsewhere in `/admin` rather than inventing a new visual language.

---

## Verification

1. Part A's findings are reported clearly: every round in the database, and confirmed source of Spencer/Dominic/Grant/Ian's stale data.
2. After cleanup, `/leaderboard` shows only real, current data — no phantom "thru 18" entries.
3. The current GreyHawk round's in-progress scoring (Chris's active match) is completely unaffected by the cleanup.
4. The admin round-count visibility (Part C) is in place and would have made this drift visible earlier.
5. The Rounds & Matchups admin screen now groups controls per-round (Part D) — scannable, not a flat wall of rows; all existing actions (save matchup, remove matchup, delete round, add round, set buy-in) still work exactly as before, just reorganized.
6. No regression: all engine tests still green; other screens (`/score`, `/duos`, `/money`, `/schedule`, `/champions`) unaffected.

## Close-out

Session addendum (shipped / commits / deviations / open issues — especially Part A's findings on Dominic/Grant/Ian's data source, and whether Part C's simple approach was sufficient or a heavier fix is warranted), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md`.
