# THE HEDGES INVITATIONAL — BUILD PLAN

**Now:** July 2026 · **Trip (the only hard date):** Mar 26–28, 2027 · **Draft:** run offline Fri Mar 26, entered via admin
**Rule:** a milestone is complete when it survives Chris's thumbs on a real phone — never when described. v2.0 (rewritten to the Brief 32–37 order, Oct 6, 2026)

---

## Milestones

| # | Milestone | Gate (the demo) | Target |
|---|---|---|---|
| **M0** | **Scaffold.** Repo, Supabase project, Vercel pipeline, PWA shell, roster seeded, `/docs` mirrored. | Live URL opens on Chris's phone showing the 16-man roster from the database. | Aug 2026 |
| **M1** | **Playable scorecard.** One foursome, one round: hole entry, do-over taps, live duo match state (F9/B9/18). | Chris scores a real 18 on it. | mid-Sep 2026 |
| **FT1** | **Field test 1 (v1 scorecard)** — completed as the Jul 27, 2026 test round. | Survives strangers' thumbs + sunlight. | ✅ Done |
| **M2** | **Full engine (v2).** PRODUCT_SPEC_V2 §2 as pure functions; simulated-full-trip suite green. | Suite passes. | ✅ Done (rebuilt for v2.0 in Brief 31) |
| **M3** | **Live multiplayer + admin foundation (v1).** Realtime, PIN identity, admin, Challenge Ledger, schedule, champions wall. | Built on v1.0 — superseded by the v2 rebuild below. | ✅ Closed (v1) |
| **32** | **Courses + rounds + admin seeding.** Real course data, both trip rounds, tee times (Arizona time), admin for courses/rounds/teams/duos. | On Chris's phone: `/admin` shows both courses with correct pars/yardages, Sunday's tee switches Purple ↔ White, tee times render in Arizona time, a test duo pairing can be created and deleted. | Oct 2026 |
| **33** | **Scorecard rebuild — scramble + optional best ball, QA sandbox, green build.** Duo/player entry, Drives Used (scramble), reverse mulligan, Max per hole, live F9/B9/18, Corrections, `/score` on the Brief 30 design system. | Two-device play of a scramble and a best-ball QA match on the production URL. | Oct 2026 |
| **FT2** | **Two-device live gate (QA sandbox)** — no fall field test (season over); Brief 33 is tested at home on the production URL with the QA sandbox, which the February dress rehearsal reuses. | One scramble + one best-ball QA match, two devices. | Oct 2026 |
| **34** | **Cup leaderboard + match detail + `/board` TV view + `/schedule` tee-time cards + QA full-trip scenarios + the pressure-test protocol.** | The adversarial pressure test passes in full; then Chris's phone + TV look-and-feel check. | Oct 2026 |
| **35** | **Pairings Night board.** Live declare-and-counter draft, coin flip, forced fourth match, Sunday reversal. | Chris runs a full mock Pairings Night with phones watching. | Dec 2026 |
| **36** | **Ledger presets + Rulebook v2 copy in-app.** | One-tap bets work; `/rulebook` matches RULEBOOK_V2. | Jan 2027 |
| **37** | **Print pack.** Pre-printed scorecard PDFs + printable Cup board (paper cards are canon-adjacent: signed card reconciles disputes). The printable Cup board can mirror the **`/board` layout** (two round columns, four match rows each, big Cup score). **Needs a best-ball scorecard variant** (four player rows instead of two duo rows, no Drives Used row) for a best-ball Sunday. | A printed card matches the app's holes, pars and yardages. | Jan 2027 |
| **Live gate** | **Two-device live gate** — two phones scoring simultaneously, realtime across both. | Both phones agree within seconds. | Jan 2027 |
| **M4** | **Dress rehearsal (February).** One simulated trip day with 3+ humans on their own phones — admin setup, Pairings Night, scored holes, settle-up; punch list cleared. | The rehearsal itself. | Feb 2027 |
| **Freeze** | **Feature freeze (Mar 1, 2027); fixes only.** Courses, tees, tee-time confirmations loaded. | Chris sign-off. | Mar 1, 2027 |
| **Live** | Draft runs offline → Chris enters teams in admin → Pairings Nights Fri/Sat → cup decided Mar 28. | The trip. | Mar 2027 |

**Order note:** the rebuild is **scorecard-first** (reordered Oct 6, 2026) so the app can be field-tested on a real round before the Bozeman season closes. The Pairings Night draft is a single March evening and can wait; an untested scorecard can't. Trip-week tasks for Chris: collect 16 indexes and enter them; enter teams after the offline draft.

## Status

| Item | State |
|---|---|
| Grounding docs | ✅ v2.0 — PRODUCT_SPEC_V2, RULEBOOK_V2, ARCHITECTURE reconciled through Brief 32 |
| M0, M1, M2 (v2 engine), M3 (v1) | ✅ Closed |
| Brief 30 (design system) · Brief 31 (schema + engine → v2.0) | ✅ Closed |
| Brief 32 (courses, rounds, admin seeding) | 🟡 Code complete; migrations 0026/0027 pending Chris's run, then phone verification |
| Briefs 33–37, live gate, M4, freeze | ⬜ Not started |
| Pending inputs (SPEC §6) | 🟡 Roster locked · indexes trip-week · tee-time confirmations (Sat 11:00 / Sun 11:40) pending · Silverado tee time TBD |

## Session log convention

Briefs numbered (`Brief 1`, `Brief 2`, …). After each Claude Code session: short addendum (shipped / commits / deviations / open issues) uploaded to project knowledge. This table updated.
