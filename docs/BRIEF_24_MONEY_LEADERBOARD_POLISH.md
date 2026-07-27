# BRIEF 24 — MONEY & LEADERBOARD POLISH

**Project:** The GUI Invitational app · **Type:** UI additions/polish, punch-list items · **Issued:** Jul 26, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 23 shipped (Scorecard Ryder Cup redesign).
**Gate:** the leaderboard shows a projected Sunday pairing preview once Saturday standings exist; `/money`'s round selector is impossible to miss; the running ledger visually distinguishes skins winnings from Challenge Ledger winnings at a glance.

---

## Context (read once)

Three smaller, related items grouped from the backlog queued at the end of Brief 21.

**Sunday pairings preview** was originally planned in Brief 14 (Part C) but skipped — at the time there was no clean way to know which round was "Saturday" vs "Sunday." Brief 17 later noted this is already solvable for free: per Rulebook v1.6, format is fixed by day (`shamble` = Saturday, `four_ball` = Sunday, always). This is now genuinely unblocked.

**Money round-selector prominence** and **ledger color-coding** are both straightforward `/money` polish items Chris flagged directly.

Grounding: `gui_invitational_mockup.html` (the original "Sunday, as it stands" card design on the Cup screen — reuse this pattern), `BRIEF_5_ENGINE_M2_SUITE.md` Part B (`computeEarnedPairings()` — already built, tested, handles chip-off-required seeding ties correctly; this brief just displays its output, doesn't touch the function), `BRIEF_17_TEE_TIME_SLOTTING.md` (the format-determines-day finding that unblocks this).

---

## Scope — Part A: Sunday pairings preview

- On `/leaderboard` (The Cup view is the natural home, per the mockup), once a `format === 'shamble'` round exists with standings computable, show a "Sunday, as it stands" card: the projected earned pairings (1st vs 2nd, 3rd vs 4th) computed live from current Saturday standings via `computeEarnedPairings()`.
- Update live as Saturday's standings shift (same realtime pattern already used elsewhere on this screen).
- Handle gracefully: no shamble round exists yet (don't show the card, or show a clear "not yet available" state); Saturday incomplete (standings and thus the preview are provisional — fine, that's expected, just don't present it as final); a seeding tie that surfaces `chipOffRequired` (display that clearly, consistent with how the Cup standings already handle this — never fabricate an order).
- This is explicitly a **preview** — the actual Sunday round/matchups still get created and locked in by Chris via admin, same as today. This card doesn't change that workflow, just shows what's projected before he does it.

## Scope — Part B: Money round selector — more prominent

- Find `/money`'s current round selector and make it significantly harder to miss — larger, clearer visual weight, following the same "big and near the top" standard established in Brief 9's home-page button work. Use judgment on exact treatment, but the bar is: a player glancing at the screen immediately understands which round's money they're looking at and can easily switch.

## Scope — Part C: Running ledger — differentiate skins vs Challenge Ledger winnings

- In the running ledger (the per-player net settle-up view), visually distinguish entries/contributions coming from skins versus from the Challenge Ledger — color-coding is a reasonable approach (e.g., one color for skins line items, another for challenge bet line items), but use whatever treatment reads clearly against the existing color palette (spruce/cream/gold/red) without adding a confusing new color that clashes.
- The final net number per player stays a single blended total (that's the point of the running ledger — one settle-up number), but the breakdown feeding into it should be visually scannable by source.

---

## Verification

1. Sunday pairings preview appears once a shamble round exists, correctly reflects current Saturday standings, updates live, and handles the no-data/incomplete/chip-off-tie cases gracefully.
2. Money's round selector is clearly, immediately visible — not something you have to hunt for.
3. Running ledger visually differentiates skins vs. Challenge Ledger contributions per player; the final total is still one clear number.
4. No regression: `computeEarnedPairings()` itself unchanged (display-only usage); all engine tests still green; Brief 21's skins carryover and Brief 22's cutoff fix unaffected.

## Close-out

Session addendum (shipped / commits / deviations / open issues), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` — closes three items from the punch list.
