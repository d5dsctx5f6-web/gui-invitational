# GUI INVITATIONAL — BUILD PLAN

**Now:** July 2026 · **Trip (the only hard date):** Mar 26–28, 2027 · **Draft:** run offline Fri Mar 26, entered via admin
**Rule:** a milestone is complete when it survives Chris's thumbs on a real phone — never when described. v1.1

---

## Milestones

| # | Milestone | Gate (the demo) | Target |
|---|---|---|---|
| **M0** | **Scaffold.** Repo, Supabase project, Vercel pipeline, PWA shell, roster seeded, `/docs` mirrored. | Live URL opens on Chris's phone showing the 16-man roster from the database. | Aug 2026 |
| **M1** | **Playable scorecard.** One foursome, one round: hole entry, do-over taps, live duo match state (F9/B9/18). | Chris scores a real 18 on it. | mid-Sep 2026 |
| **FT1** | **Field test 1** — take M1 on a real round with 2–3 buddies before the season ends. | Survives strangers' thumbs + sunlight. | Sep–Oct 2026 |
| **M2** | **Full engine.** Everything in PRODUCT_SPEC §2 as pure functions; simulated-full-trip test suite green; open spec items (§5) resolved and encoded. | Suite passes; Chris audits a simulated trip's standings, skins, ledger by hand. | Nov 2026 |
| **M3** | **Live multiplayer + events.** Realtime across devices; blind duo submissions; admin panel (teams, captains, matchups, indexes, course setups, corrections, toggles); skins opt-in; Challenge Ledger; schedule; champions wall. | Four phones score simultaneously; Chris enters a full team/matchup setup via admin in under 5 minutes. | Jan 2027 |
| **M4** | **Dress rehearsal.** One simulated trip day with 3+ humans on their own phones — admin setup through scored holes to settle-up; punch list cleared. | The rehearsal itself. | Feb 2027 |
| **Freeze** | Feature freeze; fixes only. Courses, tees, buy-in loaded. | Chris sign-off. | Mar 1, 2027 |
| **Live** | Draft runs offline Mar 26 → Chris enters teams & matchups in admin → cup decided Mar 28. | The trip. | Mar 2027 |

**Schedule note:** with the draft outside the app, nothing must ship before the trip itself — the March 12 captain draw needs no software. The Jan/Feb targets stand anyway; the buffer is the point. Trip-week tasks for Chris: collect 16 indexes, enter them; enter teams/matchups after draft night.

## Status

| Item | State |
|---|---|
| Grounding docs | ✅ Written · synced Jul 20, 2026 |
| Brief 1 (M0 scaffold) | ✅ Issued Jul 20, 2026 — ready for Claude Code |
| M0 → M4 | ⬜ Not started |
| Open spec items (SPEC §5) | ⬜ Resolve before M2 |
| Pending inputs (SPEC §6) | 🟡 Roster locked · indexes trip-week · courses/tees/buy-in open |

## Session log convention

Briefs numbered (`Brief 1`, `Brief 2`, …). After each Claude Code session: short addendum (shipped / commits / deviations / open issues) uploaded to project knowledge. This table updated.
