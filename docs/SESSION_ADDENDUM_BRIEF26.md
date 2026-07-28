# Brief 26 — Timezone Fix + Text Sizing Pass · Session Addendum

**Date:** July 27, 2026

**Shipped:** two grouped fixes, both display/formatting only — no engine involvement. Pushed to
`main`.

## Part A — diagnosis

Confirmed the actual mechanism before touching anything, per the brief's own instruction not to
guess. The bug wasn't "the browser's local timezone" as the brief's own framing anticipated —
it's broader than that:

- **Write path** (`app/admin/actions.ts`): admin's `<input type="datetime-local">` produces a
  timezone-naive string ("2027-03-27T09:00", no offset). The Server Action then ran
  `new Date(teeTimeRaw).toISOString()` — and `new Date()` on a naive string is interpreted using
  the **executing runtime's own ambient timezone**. Since this runs server-side (a Next.js Server
  Action, not browser JS), that's whatever timezone the **server process** happens to be in
  (Vercel's default, or Chris's own Mac in local dev) — not necessarily even the browser Chris is
  typing into, let alone Arizona.
- **Read path**, 5 call sites, all with the same defect but two different ambient zones depending
  on where the code runs: `Scorecard.tsx` and `MoneyScreen.tsx` are client components
  (`toLocaleTimeString(undefined, …)`) → the **viewing player's own phone's** timezone.
  `duos/page.tsx`, `schedule/page.tsx`, and admin's own `toDatetimeLocal()` edit-form prefill are
  server components → the **server process's** timezone, same as the write path.
- Net effect: nothing in the whole chain was ever anchored to Arizona. It happened to "look
  right" only when every machine involved (Chris's laptop, the server, the viewing phone) was
  coincidentally already in Arizona time — exactly the false-confidence trap the brief's own
  verification section warns about.

## Part B — the fix

New `lib/timezone.ts`, three functions, all built around the one simplifying fact that Arizona
never observes DST (fixed UTC-7 year-round, no calendar-aware DST math ever needed):

- `arizonaLocalToUtcIso()` — parses a `datetime-local` string as Arizona wall-clock time via
  manual offset arithmetic (`Date.UTC(...) `+ 7 hours), not `new Date(string)`. Used by both
  `admin/actions.ts` write sites (`matches.tee_time`, `schedule_items.starts_at` ×2).
- `formatArizonaTime()` / `formatArizonaDate()` — `Intl.DateTimeFormat` with an explicit
  `timeZone: "America/Phoenix"`, which is correct in any executing environment by construction
  (the ICU timezone database, not the ambient runtime, drives the conversion). Wired into all 5
  display call sites: `Scorecard.tsx`, `MoneyScreen.tsx`, `duos/page.tsx`'s deadline text,
  `schedule/page.tsx`'s `dayLabel`/`timeLabel` (used for both `schedule_items` and `matches`
  tee times on that page).
- `utcIsoToArizonaDatetimeLocal()` — the inverse of the write-side function, so admin's edit form
  re-opens showing the Arizona time Chris originally set, not a value shifted by the server's own
  ambient zone. Wired into admin's shared `toDatetimeLocal()` prefill helper (used for both
  `matches.tee_time` and `schedule_items.starts_at` edit forms).

**One caveat worth flagging, not a code gap**: this fixes formatting and all future writes going
forward. It can't retroactively correct any tee time that was already stored under the old buggy
write path if Chris happened to enter it from a non-Arizona-zoned machine before this fix shipped
— the stored UTC value itself would already be off by whatever offset separated that machine's
zone from Arizona's. Worth a quick spot-check of the two real tee times currently in production
against what Chris actually intended, though both look plausible (see verification below).

## Part C — text sizing pass

No central design-system font-size scale exists anywhere in this app (`app/globals.css` only
defines color variables) — every `.module.css` file hardcodes its own sizes independently. Per
the brief's own conditional ("extend only if the same small-text pattern is found via the
central-value check"), since there's no shared lever to pull, the fix is scoped to
`Scorecard.module.css` only, not spread across other screens. Bumped: `.chip` (do-over
availability chips — Chris's direct complaint, 8px → 11px, the worst offender by far),
`.holemeta` (par/yardage/stroke index, 11px → 13px, the brief's other named example), plus
`.navbtn`, `.hint`, `.rmtxt`, `.editingBadge`, `.rmNote`, and `.noIndexNote` (11-12px, all
secondary-but-functionally-important text read during live entry — RM status, "already posted,"
"no index on file"). Left untouched: the hole-strip grid tiles, segment badges, and stripkey
legend (Brief 23's compact/glanceable elements) — these are tight-grid, quick-glance badges by
design, not continuously-read body text, and enlarging them meaningfully would require
restructuring their grid layouts, out of scope for a sizing pass.

## Verification

- `npm run lint` — clean.
- `npm run build` — clean, all 9 routes, no TypeScript errors.
- `npm test` — **97/97**, unchanged (display/formatting only, as expected).
- **Timezone fix, tested under the actual real bug condition, not a masked one**: first
  mathematically verified `arizonaLocalToUtcIso`/`formatArizonaTime`/`utcIsoToArizonaDatetimeLocal`
  with `TZ=America/New_York npx tsx` — correct in every case including day-rollover and midnight
  edge cases. Then ran the real Next.js dev server itself with `TZ=America/New_York` forced (a
  genuinely non-Arizona server timezone, the real bug condition) and checked two real pages
  against real production `tee_time` values (`2026-07-26T09:00:00Z` and `2026-07-27T01:12:00Z`):
  `/schedule` (public) correctly showed **2:00 AM** and **6:12 PM** — both independently
  calculated as the correct Arizona-time conversions, and notably *not* what the old Eastern-time
  bug would have shown (5:00 AM / 9:12 PM). Signed into `/admin` (commissioner passcode, not a
  player identity — same standing practice as every prior admin-verification session; passcode
  read from `.env.local` into a temp file, deleted immediately after use) and confirmed both
  matches' edit-form prefills showed the identical `2026-07-26T02:00` / `2026-07-26T18:12` —
  proving the display and admin-prefill paths agree, both correctly Arizona-anchored, under a
  forced non-Arizona server environment. Also confirmed via a temporary fake-data QA route
  (`app/qa-scorecard`, same pattern as Briefs 12/23/24/25, deleted before commit) that the
  client-side `Scorecard.tsx` path renders correctly too: a synthetic `16:00:00Z` tee time
  correctly showed "9:00 AM tee" in the header.
- **Text sizing** confirmed visually on a real 375×812 mobile viewport via the same QA route: the
  "BB AVAIL"/"MULL AVAIL" chips and the "PAR 4 · 380 YDS / STROKE INDEX 1" hole metadata are now
  clearly, comfortably legible — a dramatic, visible improvement from the original 8px/11px.
- Both temporary artifacts (the port-3001 forced-timezone dev server, the QA route) confirmed
  fully removed — `git status --short` shows no trace, port 3001 confirmed free.

## Out of scope, confirmed untouched

The engine (zero changes — purely display/formatting), every other screen's own independent CSS
(no central scale existed to justify touching them), and Brief 17/22's underlying tee-time
mechanics (only the formatting layer changed, not what gets stored or when a duo/skins deadline
computes from).

## Open items carried forward

Unchanged from Brief 25's addendum, plus: whether Chris wants to spot-check the two real
production tee times currently stored (see the caveat above — they could theoretically be off if
originally entered pre-fix from a non-Arizona machine, though both currently display as plausible
times).

## Next

This closes both items from Brief 21's original punch list note. Remaining queued: the FK cascade
gap (team deletion orphaning `hole_scores`), paper backup scoping, and Brief 7's live two-device
gate. M4 — the dress rehearsal — remains the next real milestone.
