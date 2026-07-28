# BRIEF 26 — TIMEZONE FIX + TEXT SIZING PASS

**Project:** The GUI Invitational app · **Type:** correctness fix + UX polish, punch-list items · **Issued:** Jul 26, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 25 shipped (Rulebook screen).
**Gate:** a tee time set in admin displays as the same Arizona wall-clock time to every player, regardless of the device's own timezone setting; text across the scorecard and other player-facing screens is comfortably readable one-handed, in sunlight — matching the standard PRODUCT_SPEC §4 already commits to.

---

## Context (read once)

Two grouped fixes, both real and both flagged directly by Chris.

**Timezone.** Tee times (`matches.tee_time`, and possibly `schedule_items.starts_at`) are `timestamptz` values, currently rendering in whatever timezone the *viewing device* happens to be set to — not fixed to Arizona, where the trip actually happens. Since the whole point of a tee time is "what time do I need to be on the tee, in Arizona," this needs to be **anchored to `America/Phoenix` explicitly**, both on input (when Chris sets a time in admin) and on display (whoever's looking at it, wherever their phone thinks it is). Arizona does not observe daylight saving time, which simplifies this — it's a fixed offset year-round, not a DST-aware calculation.

**Text sizing.** Chris: "text needs to be bigger... too small" on the scorecard. This isn't a new requirement — PRODUCT_SPEC §4 already states the app must be "built for a phone in sunlight, one-handed." This brief is bringing the implementation in line with a principle the project already committed to, not inventing a new one.

Grounding: `PRODUCT_SPEC.md` §4 (player experience principles — the sunlight/one-handed standard already exists, this brief upholds it), `BRIEF_17_TEE_TIME_SLOTTING.md` (where `tee_time` was introduced — read the current admin input and every display call site before changing anything).

---

## Scope — Part A: Diagnose the timezone bug

- Find every place `tee_time` (and `schedule_items.starts_at` if it's used similarly) is **set** (admin's time input) and **displayed** (scorecard header, duo submissions deadline, `/schedule`, anywhere else per Brief 17).
- Confirm the actual current behavior: is the admin input interpreting an entered time using the browser's local timezone before storing it as UTC? Is display formatting using the viewing device's local timezone rather than a fixed zone? Report findings before fixing — this is exactly the kind of bug where guessing at the mechanism risks fixing the wrong half of it.

## Scope — Part B: Fix — anchor to America/Phoenix everywhere

- **Input:** when Chris enters a tee time in admin, it should be interpreted as Arizona wall-clock time, not the browser's local timezone at the moment of entry (relevant if Chris is ever setting up tee times from outside Arizona ahead of the trip).
- **Display:** every place a tee time renders to a human should show it in `America/Phoenix`, explicitly — regardless of the viewing device's own timezone setting. Use explicit timezone-aware formatting (e.g., `Intl.DateTimeFormat` with `timeZone: 'America/Phoenix'`, or equivalent) rather than relying on implicit browser-local formatting anywhere in this chain.
- Verify this holds even when tested from a non-Arizona timezone (whatever Chris's own dev machine is currently set to) — that's the actual bug condition, so the fix must be provably correct under that exact circumstance, not just "looks right because I'm testing from Arizona already."

## Scope — Part C: Text sizing pass

- Audit the scorecard specifically (Chris's direct complaint) for text that's too small to comfortably read one-handed, in bright sunlight — likely candidates based on prior screenshots: do-over availability chips ("BB AVAIL" / "MULL AVAIL"), hole metadata subtext (par/yardage/stroke index), and any other secondary-label-sized text.
- Check whether sizing is controlled by a central design-system value (a CSS variable, Tailwind config scale, etc.) — if so, fixing it centrally is preferable to patching individual components, and would likely also improve other player-facing screens using the same scale. Use judgment; report which approach was taken.
- Extend the pass to other player-facing screens (`/duos`, `/money`, `/leaderboard`, `/rulebook`, `/schedule`) only if the same small-text pattern is found there too via the central-value check above — don't go hunting for unrelated issues if the scorecard's problem is local to itself.

---

## Verification

1. Confirm Part A's diagnosis before fixing — report the actual mechanism.
2. Set a tee time in admin from a browser explicitly set to a non-Arizona timezone; confirm it displays as the intended Arizona time on a separately-tested device/browser also set to a different (or the same) non-Arizona timezone. This is the real test — matching timezones on both ends would mask the bug.
3. Text sizing improved on the scorecard, verified on a real mobile viewport; confirm the fix's blast radius (single component vs. central value) matches what Part C reports.
4. No regression: existing tee-time-dependent features (duo deadline computation from Brief 22, schedule display from Brief 17) still function correctly with the new fixed-timezone formatting; all engine tests still green (should be untouched — this is display/formatting only).

## Close-out

Session addendum (shipped / commits / deviations / open issues), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` — closes both items from the punch list.
