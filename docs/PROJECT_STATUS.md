# PROJECT STATUS — The GUI Invitational

**Last updated:** July 27, 2026 · **Status:** M3 is closed; Brief 9 (admin/UX hardening), Brief 10 (score routing fix), Brief 11 (RM visibility investigation, no code defect found), Brief 12 (PIN modal + duo A/B slot picker), Brief 13 (duo resubmission fix + admin duo view/set/reset), Brief 14 (the live leaderboard — a new core screen), Brief 15 (stale leaderboard data fix + rounds admin cleanup), Brief 16 (leaderboard score display — net-to-par + gross), Brief 17 (tee time slotting), Brief 18 (null handicap index fix — a real correctness bug), Brief 19 (gross-sorted individual race toggle), Brief 20 (admin Corrections reorganized into a round → match → hole drill-down), Brief 21 (skins cross-round carryover — a documented policy reversal — plus a fix to which number the leaderboard toggle actually makes prominent), Brief 22 (skins opt-in cutoff now reads the player's own match tee time, no early offset), Brief 23 (Scorecard redesigned Ryder Cup style — collapsible full breakdown, a compact always-on up/down indicator, and a prominent hole-winner banner), Brief 24 (Sunday pairings preview on the leaderboard, a much more prominent Money round selector, and skins-vs-Challenge-Ledger color-coding in the running ledger), Brief 25 (the in-app Rulebook screen — a new player-facing `/rulebook` with 9 collapsible sections, plus one real accuracy fix found and corrected in the "how ties get broken" copy), and Brief 26 (every tee time now explicitly anchored to Arizona time regardless of the viewing device's or server's own timezone, plus a Scorecard text sizing pass) all built and pushed on top of it. Outstanding: Brief 7's live two-device gate (now also covers `/leaderboard`'s realtime), Brief 9's own live verification, Chris's own live click-through of the duo slot picker as a real captain, confirming the resubmission-before-reveal assumption from Brief 13, Chris confirming Brief 20's actual write path on his own device, Chris confirming on `/money` that a real unresolved Saturday skins tail actually carries into Sunday's pool once the real trip produces one, Chris confirming two players in different-tee-time matches see correctly different skins cutoffs once a round has more than one matchup posted, Chris's own live click-through of the redesigned Scorecard as a real player, Chris glancing at the real Sunday pairings preview once production has all 4 teams and a shamble round (this session only live-verified the "not yet available" state against real data — the determined/chip-off states came from a temporary fake-data QA route), and **running migrations `0020`/`0021`/`0022`/`0023`** — all independent and can happen on their own schedule — read this first before resuming.

---

## Shipped & pushed

- **M0 — scaffold**: Next.js/TS PWA, Supabase, Vercel prod at [gui-invitational.vercel.app](https://gui-invitational.vercel.app), roster of 16 live.
- **Brief 2** — full DB schema + engine core (handicap conversion, net scoring, F9/B9/18 match state).
- **M1** — playable scorecard, verified on a real phone across a full 18.
- **Brief 4** — skins, reverse-mulligan two-score rule, individual race (34 tests).
- **Brief 5** — standings, earned Sunday pairings, chip-off tie surfacing, shortened event, allowance config, and the full simulated-trip suite (77 tests total, all green).
- **Scorecard fixes** — success/error write feedback, "already posted" indicator, running gross/net totals per player.
- **Brief 6 (M3 Part 1) — CLOSED, verified live**: the two carried-forward items closed (`reverse_mulligans` unique constraint; `hole_scores` interim anon-write revoked and replaced with an identity-scoped policy). Real player identity (name + 4-digit PIN, riding on Supabase Auth anonymous sign-in) and a passcode-gated `/admin` panel (teams, matchups, indexes, course setups, and the key one — corrections that ripple downstream with no redeploy). Verified live on Chris's phone: PIN sign-in works and persists, admin passcode gate works, a live score correction and a mulligan toggle both rippled through to the scorecard in real time with no redeploy. Three bugs were caught and fixed mid-verification: a sign-in dead-end (`092268c`), an anon-only-read RLS regression that silently emptied every table for any signed-in device (`d5a2882`), and a pgcrypto search_path gap that broke PIN-setting (`1535863`). See `SESSION_ADDENDUM_BRIEF6_CLOSED.md`.
- **Brief 7 (M3 Part 2) — code complete and pushed, migrations run and confirmed, live gate still pending**: realtime subscriptions (`hole_scores`, `reverse_mulligans`, `duo_submissions`, `skins_entries`, `challenge_bets`) with focus/visibility-regain refetch for backgrounded phones. `/duos` — blind duo submissions, blindness enforced structurally (no draft row exists until a captain's single atomic commit). `/money` — skins opt-in with live `computeSkins()` results, and the Challenge Ledger (log/accept/settle, admin void/reassign). Reverse-mulligan calling UI + two-score capture built into the Scorecard. Engine gained `moneyLedger.ts` (skins payouts + trip-wide running ledger); 84 tests total, all green. See `SESSION_ADDENDUM_BRIEF7.md`.
- **Brief 7.5 (punch-list) — CLOSED**: a `← Home` link added everywhere it was missing — turned out to be `/duos`, `/money`, `/score`'s two early-return states, and both of `/admin`'s (the gap wasn't only `/duos`/`/money` as first flagged). Admin can now reset a player's PIN (clears `player_auth` + every `player_devices` link for them), closing the gap flagged in Brief 7's addendum before broad live testing starts. See `SESSION_ADDENDUM_BRIEF7_5.md`.
- **Brief 8 (M3 Part 3) — CLOSED, closes M3**: `/schedule` — read-only, grouped by day, pulling from `schedule_items` (stubbed since Brief 2, unused until now). `/champions` — loops over every `seasons` row, three trophy lines each (Cup, Low Man, Skins King), independently "— in play —" until admin records a winner; admin-recorded at trip's end rather than derived live, a deliberate scope choice (deriving would mean building the trip-wide standings screen this project has never had a UI for). New admin sections for both. Migration `0020` adds the three nullable trophy columns to `seasons`. Caught and fixed the same class of regression as Brief 7 before close: `/champions`' first draft queried the not-yet-migrated trophy columns in the same call as the core season fields, which would have hidden Year One entirely on a pre-migration database — fixed with the by-now-standard decoupled-fetch pattern. See `SESSION_ADDENDUM_BRIEF8.md`.
- **Brief 9 (admin & UX hardening) — code complete and pushed, live gate pending**: admin delete for courses/rounds/teams/matches/challenge bets, dependency-aware confirmations backed by real `ON DELETE CASCADE` FKs (migration `0021`) rather than manual multi-step deletes. Rounds now display as "Course — Format" everywhere. Home page's primary actions are bigger and moved above the roster; back-links and the roster picker got real touch targets. The actual bug fix: admin never had a reverse-mulligan removal capability at all — built one, and it correctly clears the affected hole's stale `match_strokes` on removal, not just the event row. Scorecard now shows a course/format/date header. Skins opt-in is a confirm-then-lock one-way door for players, with an admin override to remove a mistaken entry. See `SESSION_ADDENDUM_BRIEF9.md`.
- **Brief 10 (score routing fix) — CLOSED**: `/score` no longer grabs "the first match in the table" — it derives the signed-in player's actual match from identity (`team_members` → `matches` → the specific slot via `duo_submissions`, since a team pairing is *two* match rows sharing the same team IDs, not one — team membership alone can't tell them apart). Verified by hand-tracing the real production data for the exact scenario that surfaced the bug (Zac Jones landing on the wrong matchup) plus a cross-check on an unrelated matchup and a same-foursome grouping check for the Brief 7 realtime gate — all three traced correctly. See `SESSION_ADDENDUM_BRIEF10.md`.
- **Brief 11 (RM visibility investigation) — CLOSED, no code defect found**: investigated the suspected "reverse mulligan calling only visible to team captains" regression. Full audit of `Scorecard.tsx`, `/score/page.tsx`, and every relevant RLS policy found no captain-based check anywhere — RM calling rights are already scoped to "either real player in the duo playing this match," exactly matching Rulebook v1.6 §5. Hand-traced 3 real non-captain players against live production data (including Team Jones' own captain's duo-B *player-2* slot, ruling out a subtler "first-listed player only" bug too) — all resolve and gain calling rights correctly. Added a clarifying comment at the check site to head off a future accidental regression via the (correctly) captain-scoped `duo_submissions` write policies. See `SESSION_ADDENDUM_BRIEF11.md`.
- **Brief 12 (PIN modal + duo A/B selection) — CLOSED**: sign-in is now a bottom-sheet modal (mockup's `.sheet`/`.sheetback` pattern) instead of a full-page takeover — new `SignInModal`/`SignInGate`, triggered from the home roster and from signed-out gates on `/score`/`/duos`/`/money`. The real fix underneath: `submitPin()` used to hard-navigate via `window.location.href`; it now calls `router.refresh()`, so success closes the modal in place with no reload and no `redirectTo` plumbing needed. Duo A/B selection in `/duos` no longer cycles a tapped player through off→A→B→off on repeat taps — replaced with four explicit slots (two per duo), each an empty "+ Add player" or a filled chip with a `×` to remove; tapping an empty slot opens a picker of only the not-yet-placed roster. Verified live for the modal (real triggers, no PIN submitted); the duo picker was verified against a temporary local-only QA route with fake data (never touching a real player identity), deleted before commit. See `SESSION_ADDENDUM_BRIEF12.md`.
- **Brief 13 (duo resubmission fix + admin override) — CLOSED**: diagnosed Chris's "stale duo picks" report and found the write path (`upsert` on `(round_id, team_id)`) has been correct since Brief 7 — confirmed zero duplicate rows in production. The real bug: `TeamStatusRow` stopped rendering `CaptainForm` the instant any submission existed, so a captain had no way back into the form to fix a mistake — not a failed write, an unreachable one. Fixed by letting the captain (never teammates) keep seeing the form pre-reveal regardless of submitted status, pre-filled from the existing picks, with a success message and an "Update duos" label once resubmitting. Also built the missing admin capability PRODUCT_SPEC §3 calls for: a new "Duo submissions" section in `/admin` showing every team's lineup per round (deliberately exempt from the blind-reveal rule — a commissioner override), direct set/edit via roster dropdowns, and a reset action. See `SESSION_ADDENDUM_BRIEF13.md`.
- **Brief 14 (the live leaderboard) — CLOSED**: a new `/leaderboard` screen — there had never been one in the real app despite the engine computing team standings and the individual net race correctly since Brief 5. Computes every match's `TeamMatchOutcome` from raw `hole_scores` + `duo_submissions` (the same slot-resolution insight from Brief 10) across every round, feeding one `rankTeams()` call for the whole-trip Cup race and one `computeIndividualRace()` call for the net race (daily lows included). Every `chipOffRequired` bucket renders explicitly — verified against a real, naturally-occurring 4-way tie in production (only one team had duo picks on record, so no match could resolve yet). Individual race showed a real tie displayed correctly as equal values, not a fabricated order. Realtime wired on `hole_scores`/`duo_submissions`/`matches` (unfiltered, spans the whole trip). Home page's new gold `LEADERBOARD →` button sits *above* "Score a round" — the single most prominent element on the page now, not a fifth grid button. Part C (Sunday pairings preview) deliberately skipped — no schema field distinguishes Saturday from Sunday rounds, and guessing a convention risked being wrong later. See `SESSION_ADDENDUM_BRIEF14.md`.
- **Brief 15 (stale leaderboard data fix + rounds admin cleanup) — CLOSED**: diagnosed Chris's "phantom thru-18 players" report and found the brief's own hypothesis (a leftover Brief 3/M1 demo round) doesn't match reality — that demo scaffold is already gone, and there is exactly **one** round in the database, the same one Chris is actively scoring in real life. The real cause: that round's *other* matchup (Lacko v Spenny) has a complete 18-hole test round left over from an earlier verification pass for Dominic Ikeler, Ian Hastings, Spencer Petersen, and Grant Brogan, sitting alongside Chris's real in-progress Deliso-v-Jones scores in the same round. New migration `0022` deletes exactly those 4 players' `hole_scores` (and one stale `reverse_mulligans` row caught during verification) — never the round itself, which would have destroyed Chris's real active data too. Also added a light admin round-count guardrail (Part C) and reorganized `/admin`'s Rounds & Matchups into per-round bordered cards (Part D) instead of one flat list. See `SESSION_ADDENDUM_BRIEF15.md`.
- **Brief 16 (leaderboard score display — net-to-par + gross) — CLOSED**: the individual race now shows standard golf to-par formatting (E / +N / −N, real minus sign) instead of a raw cumulative stroke count that read as alarming (e.g. Cam Delaney's "+16" through 3 holes, which was just his raw total — his actual net-to-par is +3). `engine/src/individualRace.ts` gained optional `gross`/`par` fields on `PlayerHoleNet` and `cumulativeGross`/`parPlayed` on `IndividualStanding` — optional so the Scorecard's live per-match running totals and existing engine tests needed zero changes. Gross-to-par now shown alongside net-to-par on `/leaderboard`. The Cup (points, not strokes) and the Scorecard's raw running totals (a same-match, same-hole-count scorekeeper reference) were checked and deliberately left unchanged. See `SESSION_ADDENDUM_BRIEF16.md`.
- **Brief 17 (tee time slotting) — CLOSED**: matches can now carry a real tee time (new migration `0023`, `matches.tee_time timestamptz`). Admin assigns/clears one per matchup right in the per-round cards (Brief 15 Part D); the scorecard header shows it when set; the duo submissions deadline is now computed from the round's real earliest tee time minus 30 minutes instead of a generic date-only placeholder, falling back gracefully when unset; `/schedule` shows each round's tee times as their own labeled section, one line per matchup (team pairing + slot, since a pairing's two slots share team names). Caught and fixed a real bug during verification: the first pass added `tee_time` directly into three *existing* `matches` queries (`/score` routing, `/admin`'s core fetch, `/duos`'s pairings fetch) — confirmed live that this fails the whole query pre-migration, which would have broken `/score` for everyone. Fixed with the same decoupled-fetch pattern used since Brief 8. Noted (not acted on): `rounds.format` already fixes Saturday=shamble/Sunday=four-ball per Rulebook v1.6, newly unblocking Brief 14's skipped Sunday-pairings preview for whenever that comes back up. See `SESSION_ADDENDUM_BRIEF17.md`.
- **Brief 18 (null handicap index fix) — CLOSED, real correctness bug**: a player with no index on file was netting **higher** than gross by exactly one stroke (Ben Meier 97→98, Rory Makohin/Tucker Gill 96→97) — `index ?? 0` coerced "unknown" into "confirmed scratch," and on GreyHawk's tee (rating 71.4 < par 72) that produces a small *negative* course handicap, taking a stroke away instead of giving nothing. Confirmed 12 of the 16 players currently have `index: null`. Fixed at the canonical level: new `dotsForPlayer()` in `engine/src/handicap.ts` returns all-zero dots when index is `null`, full stop — the formula never runs — while a real `0.0` index still runs it normally. Both call sites (`/score`, `/leaderboard`) now use this one function instead of each hand-chaining `courseHandicap`→`playingHandicap`→`strokesForHoles` with their own `?? 0`. Added a "no index" indicator wherever dots/strokes show (scorecard entry rows, running totals, leaderboard). Live-verified against real production data: all 12 null-index players now show net exactly equal to gross; all 4 real-index players (Chris, CJ, Spencer, Will) show correct, distinct net-vs-gross gaps, completely unaffected. See `SESSION_ADDENDUM_BRIEF18.md`.
- **Brief 19 (gross-sorted individual race toggle) — CLOSED**: `/leaderboard`'s Individual Race gained a "Net / Gross" segmented toggle (defaults to Net, unchanged from Brief 16). Toggling to Gross re-sorts the identical standings list by gross-to-par ascending — both columns stay visible in both states, only order changes; no engine changes needed since `cumulativeGross`/`parPlayed` were already computed per-player since Brief 16. Display-only: `[...race.standings].sort()` on a plain numeric comparator, same "leave equal values equal, no forced tie-break" honesty rule the engine's own net sort already follows, so ties surface the same way under either sort. `raceSort` lives in its own `useState`, untouched by the realtime `refetch()` (which only calls `setSnapshot`), so a user sitting in Gross view stays there across live updates — architecturally identical to how the pre-existing Cup/Individual `view` toggle already survives refetch. Live-verified against real production data: Net order unchanged, Gross view sorted ascending by gross-to-par (+31/+33/+35/+43) correctly, daily-low badge stayed net-based in both views, toggling back to Net restored the exact original order. See `SESSION_ADDENDUM_BRIEF19.md`.
- **Brief 20 (admin Corrections reorganization) — CLOSED**: `/admin`'s Corrections section was a flat wall of every player/hole/round's score at once — "so overwhelming" per Chris's own report, and the tool he'll reach for constantly under pressure during real scoring. Reorganized into the same round → match → hole drill-down shape as the live Scorecard: pick a round (reusing the existing `RoundPicker`), pick a matchup ("Team BroMei v Team Nintendo — Slot A", same duo-slot-resolution insight as `/score`'s routing and the leaderboard), then edit exactly one hole's four players at a time with prev/next hole nav mirroring `Scorecard.tsx`'s own `.holehead`/`.navrow` pattern. The underlying write (`correctHoleScore`) is completely unchanged — same `hole_scores` UPDATE, same fields (strokes, RM match strokes, breakfast ball, mulligan). One necessary addition beyond pure reorganization: the action's post-save redirect now carries the round/match/hole back through as query params, so saving one correction doesn't bounce the admin back to round 1 — without that, the new drill-down would make losing your place *more* disruptive, not less, defeating the brief's own point. A safety-net "other scores not tied to a current matchup" fallback (styled exactly like the old flat rows) catches any hole_scores row that doesn't resolve to a player in any of the round's matches — direct insurance against a repeat of Brief 15's exact failure shape (stale rows orphaned from the active match structure), currently empty since production has no such orphans. Live-verified reads and navigation against real production data (round switch, match switch, hole prev/next all correct, exactly the 4 right players surfaced per duo submission); the actual write path could not be live-verified from Claude Code (`SUPABASE_SERVICE_ROLE_KEY` is a local placeholder, confirmed via a real submit attempt that correctly failed with "Invalid API key" and, notably, still redirected back to the exact same round/match/hole rather than resetting — confirming the new redirect logic works on both the success and error paths). See `SESSION_ADDENDUM_BRIEF20.md`.
- **Brief 21 (skins cross-round carryover + leaderboard toggle fix) — CLOSED**: two unrelated fixes bundled in one session. **Part A, a documented policy reversal** (`PRODUCT_SPEC_ADDENDUM_A.md` §2, dated Jul 26 2026): skins used to be "paid nightly," each round fully independent; Chris reversed this so an unresolved round-ending chain now rolls forward into the next round's pool instead of voiding — with exactly two competitive rounds, this only ever matters once (Saturday's leftover into Sunday's). `computeSkins()` gained an optional `carryIn` count (no dollar figure, since buy-ins can differ per round — the *count* carries, valued at the receiving round's own buy-in/entrant pool when claimed) and a `carriedIn` field on each `SkinsWin`; `skinsPayouts()` folds it into the payout multiply. A round that itself never resolves its incoming carry surfaces that fact via a new `unresolvedCarryIn` field rather than losing it silently — genuinely unresolved only for the trip's last round, exactly the edge case the brief said not to auto-resolve. `MoneyScreen.tsx` walks `rounds` (already date-ordered) forward, feeding each round's `voidHoles.length` into the next's `computeSkins()` call, with new hints surfacing carry-in and the "carrying forward vs. genuinely void" distinction. **Part B, a display bug**: the Net/Gross toggle (Brief 19) re-sorted correctly but the large prominent badge always showed net-to-par regardless of toggle state, gross stuck in secondary text. Fixed by deriving which value is primary vs. secondary from `raceSort` at render time — sort logic and the net-based ◆ daily-low badge both confirmed untouched. 93 tests (90 + 3 new dedicated cross-round-carry tests); Part B live-verified against real production data (Gross mode correctly shows +31/+33/+35/+43 as the prominent badge, sorted correctly, net secondary); Part A verified via a read-only script run directly against production data (temporary, deleted after) since `/money` requires signing in as a named real player — a line this project has never crossed. See `SESSION_ADDENDUM_BRIEF21.md`.
- **Brief 22 (skins opt-in cutoff timing) — CLOSED**: Chris wanted skins opt-in to cut off exactly at a player's own match tee time, no 30-minute-early buffer. Diagnosis first (per house practice) found the brief's own assumption wrong: `/money` had no real cutoff computation at all — the hint was a static string with no time value, and `confirmOptIn()` had zero time-based enforcement (so "not hard-blocked" was trivially true). Only `/duos` actually computes a real deadline (round-wide earliest tee minus 30, kept unchanged — that's an intentionally different, captain-lead-time rule). Added a real one for skins: `resolveMyMatchTeeTime()` in `app/money/page.tsx` resolves the signed-in player's own match for the selected round using the identical team → `duo_submissions` slot → `matches` row chain Brief 10 built for `/score` routing, decoupling the `tee_time` fetch per the project's standing defensive pattern. Any unresolved step (no team, no duo picks, no match, no tee time) falls back to generic informational text — no hard block added or changed. Verified via a read-only script against real production data (both live rounds' single match and real `tee_time` correctly resolved for all 4 entrants); couldn't demonstrate two players with genuinely different cutoffs since production currently has only one match per round — the shared resolution logic is the same shape Brief 10 already proved correct against multiple distinct matches. See `SESSION_ADDENDUM_BRIEF22.md`.
- **Brief 23 (Scorecard redesign, Ryder Cup style) — CLOSED**: the live scoring entry screen was "busy" per Chris — every part of the match state and history competing with the actual job (entering a score). Part A confirmed the per-hole win/loss/halve result was already correctly computed internally (`resolveHole()`, used by `computeSegment()`/`countHolesWon()` since Brief 2/5) but never exposed on its own — added `resolveHoleResults()` to the engine, a pure data-exposure change, no new match logic. Part C redesigned the always-visible F9/B9/18 status row from a sentence ("Team BroMei 2UP · thru 5") into a single-glance broadcast-style badge (▲2/▼1/AS, colored gold/red/neutral from the signed-in player's own duo's perspective) — same 3-tile structure kept, not rebuilt. Part B added a collapsed-by-default "Scorecard" toggle revealing the mockup's exact `.holes`/`.hole.W/.L/.H` hole-by-hole strip (`docs/gui_invitational_mockup.html`, designed before any code existed and never built until now) plus the existing Running Totals card, moved out of its old always-visible spot. Part D added a prominent banner ("Team X won hole N" / "Hole N halved") on already-posted holes, louder than the existing small "already posted" badge which stays as secondary metadata. 97 tests (93 + 4 new `resolveHoleResults` tests). Live-verified visually via a temporary fake-data QA route (`app/qa-scorecard`, same pattern as Brief 12's duo picker, deleted before commit) since `/score` requires signing in as a real player: confirmed the decluttered entry screen, a real dormie correctly showing "Closed" at 2-up-thru-8-of-9, the hole strip matching synthetic data exactly, and all three banner accent colors (gold win / red loss / neutral halve). See `SESSION_ADDENDUM_BRIEF23.md`.
- **Brief 24 (Money & leaderboard polish) — CLOSED**: three grouped backlog items. Part A adds a "Sunday, as it stands" card to `/leaderboard`'s Cup view — earned pairings projected live from `computeEarnedPairings()` (unchanged, display-only), now genuinely unblocked since `rounds.format` fixes Saturday=shamble/Sunday=four_ball per Rulebook v1.6 (Brief 17's finding). The real design work: the preview needs a Saturday-*only* ranking, not the whole-trip cumulative ranking the Cup board itself uses — added per-round outcome tracking inside `compute()` so the shamble round's own outcomes can be isolated and ranked separately, preventing Sunday's own incomplete results from ever corrupting its own seeding preview once Sunday play begins. Handles all three real states without ever fabricating an order: not-yet-available (no shamble round, or fewer than 4 teams), a genuine chip-off tie, or a determined "1st v 2nd / 3rd v 4th" — always labeled provisional ("locks tonight after the last putt"). Part B redesigns `/money`'s round selector from a thin, easy-to-miss text row into the same bold "big, near the top" visual weight as the home page's primary Leaderboard button — CSS only, the underlying links unchanged. Part C adds a by-source breakdown (gold for skins, cream for Challenge Ledger bets — both already-established app colors, nothing new) under each running-ledger entry, computed by calling the existing `runningLedger()` a second time with an empty skins map (mathematically identical to isolating the bets' own contribution) — the blended net total itself is completely unchanged. 97 tests, all unchanged (no engine touched anywhere in this brief). Live-verified: Part A's "not yet available" state against real production data (which genuinely has only 2 of 4 teams seeded right now); the determined and chip-off states, plus both Money parts, verified visually via two temporary fake-data QA routes (same pattern as Briefs 12/23), both deleted before commit. See `SESSION_ADDENDUM_BRIEF24.md`.
- **Brief 25 (the in-app Rulebook screen) — CLOSED**: a new public `/rulebook` screen (no sign-in, same tier as `/schedule`/`/champions`) for the other 15 guys — distinct from the internal `GUI_INVITATIONAL_RULEBOOK.md`, which stays Chris's own architect-facing reference. Nine collapsible sections matching Chris's provided copy almost verbatim, collapsed by default so a player can jump straight to what he's confused about (same tap-to-reveal interaction Brief 23 established for the Scorecard, applied as an independently-toggleable list here). Pure static content — no database read at all, so it's a plain client component and the only screen in the app that renders as a static route rather than dynamic. **The accuracy pass (Part C) found and fixed one real error**: the "how ties get broken" copy claimed the same tiebreaker list ("points, head-to-head, holes won") applies to the Cup, the individual title, *and* Sunday's pairings — but per `PRODUCT_SPEC_ADDENDUM_A.md` §3 the individual title actually uses a completely different ladder (cumulative net → Sunday net → Sunday back-9 net → chip-off). Dropped the inaccurate parenthetical rather than ship a wrong claim verbatim, flagged for Chris rather than silently decided. Also flagged, not touched: the internal `GUI_INVITATIONAL_RULEBOOK.md` v1.6 itself hasn't been updated to reflect Brief 21's skins-carryover policy reversal (Addendum A supersedes it, but the internal doc's own text still says "carryovers on ties" with no cross-round rollover mention) — worth a version bump whenever convenient. 97 tests, unchanged (pure content/UI, zero engine involvement). Live-verified on a real 375×812 mobile viewport: all 9 sections present and collapsed by default, nav link works, and the three most nuanced/recently-changed rules (reverse mulligan's two-score exception, skins cross-round carryover, the corrected chip-off policy) spot-checked and confirmed accurate. See `SESSION_ADDENDUM_BRIEF25.md`. *(`GUI_INVITATIONAL_RULEBOOK.md` has since been bumped to v1.7 in a follow-up, closing this note — see below.)*
- **Brief 26 (timezone fix + text sizing pass) — CLOSED**: two grouped fixes, both display/formatting only. **Timezone**: diagnosis found the bug was broader than "the browser's local timezone" — the write path (admin's `datetime-local` input → `new Date(raw).toISOString()` in a Server Action) and 3 of 5 display call sites are server-rendered, so the real culprit was whatever timezone the *server process* happened to be in, not necessarily even Chris's own browser; the other 2 display call sites (`Scorecard.tsx`, `MoneyScreen.tsx`) are client components using the *viewing player's phone*. New `lib/timezone.ts` anchors every read and write explicitly to `America/Phoenix` (fixed UTC-7, no DST ever) — `arizonaLocalToUtcIso()` for admin's writes (manual offset math, not `new Date(string)`), `formatArizonaTime()`/`formatArizonaDate()` (`Intl.DateTimeFormat` with an explicit `timeZone`) for all 5 display sites, `utcIsoToArizonaDatetimeLocal()` so admin's edit form re-opens showing the time Chris actually set. **Text sizing**: confirmed no central font-size scale exists anywhere in the app (only color variables in `globals.css`), so per the brief's own conditional the fix stayed scoped to `Scorecard.module.css` — bumped the do-over chips (Chris's direct complaint, 8px → 11px) and hole metadata (11px → 13px), plus several other secondary-but-functionally-important labels read during live entry. 97 tests, unchanged. **Verified under the actual real bug condition, not a masked one**: ran the real dev server with `TZ=America/New_York` forced and confirmed `/schedule` and the admin edit-form prefill both correctly showed Arizona time (not Eastern) for the two real production tee times, cross-checked against independent manual calculation; also confirmed the client-side path via a temporary fake-data QA route. Text sizing confirmed visually on a real mobile viewport via the same route. See `SESSION_ADDENDUM_BRIEF26.md`.

## M2 status: CLOSED

Chris's hand-audit passed both traces (net computation on a real-entered round: 85 gross − 20 dots = 65 net, matched and recomputed correctly on edit; skins void integrity confirmed via raw fixture data on two Sunday holes — genuine multi-way ties, no gaps or malformed data). The entire scoring engine — match state, handicaps, skins, the reverse-mulligan two-score rule, standings, earned pairings, shortened event, individual race — is complete and proven: 77 automated tests plus this human audit. See `SESSION_ADDENDUM_M2_CLOSED.md`.

## M3 Part 1 status: CLOSED

Verified live on Chris's phone: PIN sign-in works and persists across reload, the admin passcode
gate works, and — the key capability — a live score correction and a mulligan toggle made in
`/admin` both rippled through to the scorecard in real time with no redeploy. Three bugs were
caught and fixed mid-verification (sign-in dead-end, an anon-only-read RLS regression, and a
pgcrypto search_path gap breaking PIN-setting) — see `SESSION_ADDENDUM_BRIEF6_CLOSED.md` for the
full story. All fixes are in `main` and confirmed working.

**Open item, minor, not blocking:** `/admin` isn't directly addable to the home screen as its
own icon — the PWA manifest has a single `start_url: "/"`, so "Add to Home Screen" always
installs against `start_url` regardless of which page triggered it. `/admin` is still one tap
away from the home icon; a dedicated admin icon would need a second scoped manifest. Fix
whenever convenient.

## M3 Part 2 status: MIGRATIONS DONE, LIVE GATE PENDING

Migrations `0017`, `0018`, `0019` have been run against the live Supabase project and
confirmed — realtime publication entries, the new write policies for
`reverse_mulligans`/`duo_submissions`/`skins_entries`/`challenge_bets`, and
`rounds.skins_buy_in` are all live. What's left is the brief's own live verification gate (see
`SESSION_ADDENDUM_BRIEF7.md` for full detail):

- Two devices on the same match's scorecard, confirming a posted hole appears on the other
  within seconds with no manual refresh.
- Two captains submitting duos, confirming blind-until-both-commit then simultaneous reveal.
- Skins opt-in toggled by two different players, confirming the Money screen reflects only
  entrants.
- A Challenge Ledger bet logged, accepted (only by the named acceptor), and settled, confirming
  it lands in the running ledger.
- A reverse mulligan called on a holed shot, confirming the two-score entry works and
  availability shows correctly in both of that team's foursomes.

**Deliberately not attempted this session:** completing a PIN sign-in as any of the 16 real
roster players to test-drive these flows, since that would claim their identity slot with a
throwaway PIN and there's no admin "reset a player's PIN" capability yet to undo it. A
pre-migration smoke test did catch and fix one real regression: adding `skins_buy_in` to the
same query `/admin` used for Matchups/Corrections would have silently emptied that whole
section on the live (not-yet-migrated) database — fixed by decoupling the fetch.

**Open items, minor, not blocking:**
- No `first_tee_at` field in the schema — the 30-minutes-before-first-tee deadline is a static
  label, not a real countdown.
- ~~No admin "reset a player's PIN" capability~~ — closed by Brief 7.5.
- ~~`/score` hardcodes "grab the first match in the table"~~ — closed by Brief 10: routing is
  now identity-derived (team → duo slot), verified correct on both real matchups in production.

## M3 Part 3 status: CLOSED

`/schedule` and `/champions` are both built and pushed, migration `0020` is written (not yet
run against the live database — nothing depends on it being run immediately; both screens
degrade gracefully to "in play"/empty states until it is, same defensive pattern as
`skins_buy_in`). See `SESSION_ADDENDUM_BRIEF8.md` for full detail, including the note on why
`first_tee_at` wasn't closed here despite the brief inviting it (would have needed its own
schedule-item↔round link, more than "if convenient" scope).

## M3 status: CLOSED

All three parts are built and pushed. The **only** thing left from the entire M3 milestone is
**Brief 7's live two-device gate** (see the M3 Part 2 section above) — realtime sync, blind duo
reveal, a skins/ledger cycle, and an RM call, all confirmed on two real devices. That
verification is independent of Briefs 7.5 and 8 and can happen on its own schedule.

## Brief 9 (admin & UX hardening) status: CODE DONE, LIVE GATE PENDING

Not a milestone — a punch-list pass from Chris actually living in `/admin`. Everything is built
and pushed; migration `0021` (the delete cascades) hasn't run yet. See
`SESSION_ADDENDUM_BRIEF9.md` for full detail, including the FK schema decisions (two deliberate
`SET NULL`s instead of cascading further: a round's optional default tee, and a season's
recorded cup-winner team so deleting a team never rewrites champions-wall history).

**Honestly could not verify this session:** any admin write actually succeeding against the
live database — this local dev environment's `SUPABASE_SERVICE_ROLE_KEY` has always been a
placeholder (since Brief 6), so every admin action, not just this brief's new ones, has only
ever been write-verifiable in Chris's real environment. Did click-test the new reverse-mulligan
removal against a real row from earlier testing: the confirm gate and the Server Action both
fired correctly, and it failed cleanly with "Invalid API key" (the expected placeholder-key
failure, not a code bug) — no orphaned state, no crash, surfaced through the normal error
banner. Confirms the plumbing; the actual successful write is Chris's to run live.

**Still pending — this brief's own gate:**
1. Run migration `0021` in the Supabase SQL editor.
2. Delete a course/round/team/match/challenge bet with real dependents — confirm the message
   and the cascade.
3. Call and then remove a reverse mulligan — confirm the scorecard reverts to the real score.
4. Confirm skins opt-in's confirm-then-lock on a phone, and admin's override.
5. Eyeball the bigger nav/back-links/roster targets on an actual phone in daylight.

## Brief 10 (score routing fix) status: CLOSED

Fixed the bug Chris hit directly: signed in as Zac Jones, "Score a round" opened a matchup he
wasn't even in. `/score` now resolves the signed-in player's own match through
`team_members` → `matches` → the specific slot (A/B) via that round's `duo_submissions` row —
not `.limit(1)` on the matches table. The schema detail that mattered: a team pairing is two
`matches` rows sharing identical team IDs, so team membership alone can't disambiguate; the
real disambiguator is which duo slot the player's own `duo_submissions` entry puts them in.
Verified by hand-tracing real production data (not live click-testing, for the same
identity-squatting reasons as every prior brief) — Zac Jones resolves correctly to his real
matchup, Matt Lacko resolves independently to a different one regardless of row order, and all
four players sharing one foursome resolve to the same match, confirming Brief 7's realtime gate
still works. See `SESSION_ADDENDUM_BRIEF10.md`.

## Brief 11 (RM visibility investigation) status: CLOSED

No regression found. See the Shipped & pushed entry above and `SESSION_ADDENDUM_BRIEF11.md` for
the full diagnostic trail. Best-guess explanation for why the concern was raised: Chris, like
every session in this project, can only personally PIN-sign-in as himself for live testing (a
team captain) per the identity-squatting-avoidance policy — natural grounds for suspicion without
having traced the code against another real player's data, which this brief did.

## Brief 12 (PIN modal + duo A/B selection) status: CLOSED, ONE LIVE ITEM PENDING

Both punch-list items from Chris are built, verified (build/lint/84 tests, live smoke test of the
modal, fake-data QA pass on the duo picker), and pushed. See `SESSION_ADDENDUM_BRIEF12.md`.

**Still pending:** Chris clicking through the new duo A/B slot picker himself as a real team
captain — this session could not, since `CaptainForm` is only reachable signed in as an actual
captain, and completing a real PIN sign-in as any of the 16 players is the one thing this project
has consistently avoided throughout. Low risk (verified thoroughly against the real component
with fake data instead), but worth a quick real check before or during M4.

## Brief 13 (duo resubmission fix + admin override) status: CLOSED

Both parts built, verified (build/lint/84 tests, live admin read-view check against real
production data, fake-data QA pass for the captain resubmission flow), and pushed. See
`SESSION_ADDENDUM_BRIEF13.md`.

**Still pending:**
1. Chris confirming the resubmission-before-reveal assumption (Part B): defaulted to "captains
   can freely resubmit up until both teams commit and reveal" since the brief didn't spec this
   precisely — flagged, not assumed silently.
2. Admin's new `setDuoSubmission`/`resetDuoSubmission` writes couldn't be exercised end-to-end
   locally — same known `SUPABASE_SERVICE_ROLE_KEY` placeholder limitation as every admin write
   since Brief 6/9. Confirmed the failure mode is clean (no orphaned test data), but the actual
   successful write is Chris's to run live, same as every prior admin brief.

## Brief 14 (the live leaderboard) status: CLOSED

Both required parts (Cup standings, individual race) plus realtime + home placement are built,
verified (build/lint/84 tests, live check against real production data including a genuine
naturally-occurring 4-way chip-off), and pushed. Part C (Sunday pairings preview) deliberately
skipped — see `SESSION_ADDENDUM_BRIEF14.md` for why. `/leaderboard` is public, no sign-in needed,
same as `/schedule`/`/champions`.

**Still pending:** live two-device realtime confirmation specifically for this screen — bundles
into Brief 7's still-open gate below, since the hook itself is unmodified from what four other
screens already use.

## Brief 15 (stale leaderboard data fix + rounds admin cleanup) status: CLOSED, ONE MIGRATION PENDING

All four parts built, verified (build/lint/84 tests, reproduced the exact reported bug live
against the current unfixed database before writing the fix, confirmed the fix's targeting is
correct), and pushed. See `SESSION_ADDENDUM_BRIEF15.md` — especially Part A's findings, which
overturn the brief's own initial hypothesis.

**Key correction to the brief's premise:** there is no separate stale "demo round" to delete —
that data was already cleaned up long ago. The stale data lives *inside* the same round Chris is
actively using, on the Lacko-v-Spenny matchup he hasn't gotten to yet. The fix is row-level
(specific players' `hole_scores`, plus one stale `reverse_mulligans` row), not round-level —
deleting the round itself would have destroyed Chris's real in-progress scores too.

**Still pending:** migration `0022` needs Chris to run it in the Supabase SQL editor — same
as `0020` and `0021`, neither of which has been confirmed run yet either.

## Brief 16 (leaderboard score display) status: CLOSED

Built, verified (build/lint/86 tests, live check confirming Cam Delaney's flagged "+16" now
correctly reads "+3"), and pushed. No open items specific to this brief — see
`SESSION_ADDENDUM_BRIEF16.md` for the gross-to-par-vs-raw-gross choice and what was deliberately
left unchanged (The Cup, Scorecard running totals).

## Brief 17 (tee time slotting) status: CLOSED, ONE MIGRATION PENDING

Built, verified (build/lint/86 tests, live check against real pre-migration production data
confirming every existing screen still works and the new admin tee-time inputs render
correctly), and pushed. See `SESSION_ADDENDUM_BRIEF17.md`.

**Still pending:** migration `0023` needs Chris to run it — now four migrations queued
(`0020`, `0021`, `0022`, `0023`), none confirmed run yet.

## Brief 18 (null handicap index fix) status: CLOSED

Built, verified (build/lint/90 tests including 4 new regression-guard tests, live check against
real production data confirming all 12 null-index players now net exactly equal to gross and all
4 real-index players are unaffected), and pushed. See `SESSION_ADDENDUM_BRIEF18.md`.

No database correction needed — this was a live-recomputed display bug, not stored bad data.
Anyone with `/leaderboard` or a scorecard open in a browser tab *before* this fix landed is
looking at stale client-side state until they reload; nothing at rest was wrong.

## Brief 21 (skins cross-round carryover + leaderboard toggle fix) status: CLOSED

Both parts built, verified (build/lint/93 tests including 3 new dedicated cross-round-carry
tests, Part B live-verified against real production data), and pushed. See
`SESSION_ADDENDUM_BRIEF21.md`.

**Key thing to flag when reading this later:** Part A is a real, dated policy reversal, not just
an engine tweak — `PRODUCT_SPEC_ADDENDUM_A.md` §2 now says the opposite of what it said before
Jul 26 2026 ("paid nightly, nothing carries" → "unresolved value rolls into the next round's
pool"). The superseded text is kept struck through in the addendum itself for traceability.

**Still pending:** the two live rounds currently in production both happen to not exercise the
actual carry-in path (round 1 resolves cleanly; round 2 — the current last round — ends with its
own hole 18 tied, but has nowhere to carry to since it's the last round). The mechanism itself is
proven by dedicated engine tests plus this live production data confirming the "no false carry"
half of the gate. Once a real trip produces an actual Saturday-into-Sunday carry, Chris should
confirm on `/money` (signed in as himself) that it displays and pays out correctly — this session
could only verify the engine side, for the same identity-squatting-avoidance reason every
player-facing write has hit since Brief 6.

## Brief 22 (skins opt-in cutoff timing) status: CLOSED

Built, verified (build/lint/93 tests unchanged — no engine touched — and a live production-data
trace of the resolution chain), and pushed. See `SESSION_ADDENDUM_BRIEF22.md`.

**Still pending:** confirming two players in different-tee-time matches see genuinely different
cutoffs — production currently has only one match per round, so there's no live pair to observe
a difference against yet. Confidence comes from reusing Brief 10's already-proven multi-match
routing logic verbatim, not from a fresh live trace of that specific scenario.

## Brief 23 (Scorecard redesign, Ryder Cup style) status: CLOSED

Built, verified (build/lint/97 tests including 4 new `resolveHoleResults` tests, live visual
verification via a temporary fake-data QA route), and pushed. See `SESSION_ADDENDUM_BRIEF23.md`.
This closes the first item from Brief 21's queued backlog ("Scorecard redesign, Ryder Cup style").

**Still pending:** Chris's own live click-through as a real player during actual scoring —
this session verified the redesign visually against synthetic data (same fake-data QA pattern
Brief 12 used for the duo picker) rather than through a real signed-in `/score` session, per the
project's standing identity-squatting-avoidance policy. No write behavior changed at all this
brief (purely display/data-exposure), so there's no separate write-path gap to track.

## Brief 24 (Money & leaderboard polish) status: CLOSED

Built, verified (build/lint/97 tests unchanged — no engine touched — plus live verification, part
real production data and part temporary fake-data QA routes), and pushed. See
`SESSION_ADDENDUM_BRIEF24.md`. This closes the remaining three items from Brief 21's queued
backlog that were grouped into this brief ("Sunday pairings preview," "Money round-selector
prominence," "running ledger — color-code skins vs Challenge Ledger winnings").

**Still pending:** Chris glancing at the real "Sunday, as it stands" card once production
actually has all 4 teams and a shamble round with real match data — this session's live check
against real data only exercised the graceful "not yet available" state (production genuinely has
just 2 of the 4 teams seeded right now); the determined and chip-off-required states were verified
against synthetic data instead, same identity/data-availability-driven limitation as other recent
briefs.

## Brief 25 (the in-app Rulebook screen) status: CLOSED

Built, verified (build/lint/97 tests unchanged — pure content/UI, zero engine involvement — plus
live verification on a real mobile viewport), and pushed. See `SESSION_ADDENDUM_BRIEF25.md`. This
closes the "in-app Rulebook screen" item from Brief 21's original backlog note.

**One editorial item flagged for Chris, not blocking:** whether he wants the individual title's
own specific tiebreaker ladder (cumulative net → Sunday net → Sunday back-9 net → chip-off)
spelled out in the app copy, now that the inaccurate "(points, head-to-head, holes won) applies
to all three" claim has been removed.

~~Whether to bump the internal `GUI_INVITATIONAL_RULEBOOK.md` to v1.7~~ — done in a follow-up
turn: `GUI_INVITATIONAL_RULEBOOK.md` (both `/docs` and the Desktop copy) is now v1.7, reflecting
Brief 21's skins carryover reversal in §6 and adding the Cup/Sunday-pairings-vs-individual-title
tiebreaker-ladder distinction to §7. The Desktop copy was also several revisions further behind
than just this one item (stale reverse-mulligan wording, v1.5) and was brought fully in sync with
`/docs` at the same time.

## Brief 26 (timezone fix + text sizing pass) status: CLOSED

Built, verified (build/lint/97 tests unchanged — display/formatting only, zero engine
involvement — plus live verification under the real bug condition: the dev server itself run
with `TZ=America/New_York` forced), and pushed. See `SESSION_ADDENDUM_BRIEF26.md`. This closes
both items from Brief 21's original punch list note.

**One caveat, not a code gap:** the fix corrects formatting and all future writes going forward,
but can't retroactively correct any tee time that might have already been stored under the old
buggy write path if it was originally entered from a non-Arizona-zoned machine. The two real tee
times currently in production both display as plausible times post-fix, but Chris may want to
eyeball them against what he actually intended when he set them.

## Two must-do items now closed (were carried-forward before M3)

1. ~~Revoke the interim anon INSERT/UPDATE policies on `hole_scores`~~ — done in migration `0014`.
2. ~~Add `unique(team_id, round_id)` on `reverse_mulligans`~~ — done in migration `0012`.

## Also pending

Reconcile ARCHITECTURE §5 with the schema actually built (`course_tees` split, `duo_submissions` linkage, `par_by_hole`/`yardage_by_hole` columns, and now `player_auth`/`player_devices`). Demo-seed IDs for cleanup are recorded in `SESSION_ADDENDUM_M1.md`.

## Next up

Finish the two pending live gates (Brief 7's two-device realtime gate, Brief 9's
delete/RM-removal/skins-lock verification) whenever convenient — both independent of each
other, and Brief 10's routing fix doesn't block either. Then, per BUILD_PLAN: **M4 — the dress
rehearsal**, one fully simulated trip day with 3+ humans on their own phones, admin setup
through settle-up, end to end, on production infrastructure.
