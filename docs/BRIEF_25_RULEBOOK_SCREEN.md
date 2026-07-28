# BRIEF 25 — THE IN-APP RULEBOOK SCREEN

**Project:** The GUI Invitational app · **Type:** new screen, punch-list item · **Issued:** Jul 26, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** Brief 24 shipped (money & leaderboard polish).
**Gate:** a player who's never touched the app can open the Rulebook, find any specific rule (reverse mulligan, skins, points, tiebreakers) in a couple taps, and actually understand it — written for guys who aren't especially golf-savvy, per Chris's standing north star.

---

## Context (read once)

Chris wants a central, player-facing hub explaining every game mechanism — comprehensive but concise, friendly, not a dry rulebook. This is distinct from the internal markdown `GUI_INVITATIONAL_RULEBOOK.md` (that's Chris's own reference doc, written for the architect/builder relationship) — this screen is for the other 15 guys, written the way you'd explain it to a buddy over beers.

**The actual copy is provided below — use it verbatim or near-verbatim.** These rules have accumulated real nuance over 24 briefs (the reverse mulligan's two-score exception, skins' cross-round carryover, the chip-off-not-ties policy), and getting the wording slightly wrong here risks a real argument on the course. Don't paraphrase from memory of the spec — use the text below, lightly adjusted only for UI fit (e.g., section headers as collapsible labels).

Grounding for cross-checking accuracy before finalizing: `PRODUCT_SPEC.md` §2, `GUI_INVITATIONAL_RULEBOOK.md` v1.6, `PRODUCT_SPEC_ADDENDUM_A.md` (revised — 100% allowance, chip-off tiebreakers, skins cross-round carryover). If anything below seems to conflict with those docs, the docs win — flag the discrepancy in the addendum rather than silently picking one.

---

## Scope — Part A: The screen

- Reachable from main nav, same visual family as the rest of the app.
- Organized into clearly labeled, **collapsible sections** (reuse the collapsible pattern already established — Brief 23's Scorecard toggle, Brief 15's per-round cards) so a player can jump straight to what he's confused about rather than scroll a wall of text. Suggested sections match the headers in Part B's copy below.
- Should read well on a phone, one-handed, in sunlight — same standard as every other player-facing screen in this app.

## Scope — Part B: The content (use this copy)

---

**THE FORMAT**

16 guys, 4 teams of 4, drafted by captains on trip night. Two rounds count: Saturday is a shamble, Sunday is four-ball. (There's also a Friday fun round — that one's just for fun, nothing on this app tracks it.)

Each round, your team splits into two duos. Your duo plays another team's duo, head-to-head, match play. Four duo matches happening at once — that's four foursomes out on the course.

**HOW THE CUP GETS WON**

Every duo match is worth 3 points: 1 for the front nine, 1 for the back nine, 1 for the full 18. Win a segment, get the point. Halve it, split the point.

12 points up for grabs each day, 24 for the whole weekend. Most points after Sunday wins the Cup.

Sunday's matchups aren't random — they're earned. Whoever's 1st in the standings after Saturday plays whoever's 2nd. 3rd plays 4th. Win Saturday, you get a crack at 1st place Sunday.

**THE FORMATS, EXPLAINED**

Shamble (Saturday): everyone in the duo tees off, you pick the best drive, then everyone plays their own ball in from there. Best net score on the duo counts.

Four-ball (Sunday): play your own ball the whole hole, start to finish. Best net score on the duo counts.

**HANDICAPS — YOU DON'T DO ANY MATH**

Real GHIN index if you've got one, an assigned number if you don't. The app converts that into actual strokes for whatever course we're on that day, and shows you exactly which holes you get a stroke on. You never calculate anything — just play, the dots are already there.

**DO-OVERS**

Once a round: one breakfast ball (redo your very first tee shot only) and one mulligan (redo any other shot, except once you're on the green). Whatever you make after the do-over is your real score — it counts everywhere: the match, skins, your individual total.

**THE REVERSE MULLIGAN — THE TEAM WEAPON**

Once per team, per round. Either of your duos can use it — it's shared across the whole team, not one per duo.

Here's how it works: your team can force an opponent to replay any one shot — a drive, an approach, even a putt. He hits it again and plays on from there. He doesn't play two balls.

The twist: if the shot you're reversing was already in the hole, it still counts as made for that guy's own skins and individual race — even though your team's match sees the miss. Everything else, the replay is just the real, final score.

Call it immediately, before the next shot — or it's gone.

**INDIVIDUAL RACE**

Runs the whole weekend, separate from the team stuff. Lowest cumulative net across both rounds wins. Daily low net gets a nod too (no cash, just bragging rights).

**MONEY — TWO THINGS, THAT'S IT**

Skins: opt in before your round's tee time (once you're in, you can't back out). Gross score, lowest score on a hole wins it outright — no strokes given. Tie for low? It carries to the next hole. If a round ends with skins still unclaimed, that pot doesn't disappear — it rolls forward into the next round.

The Challenge Ledger: any bet, anytime, between any two guys. Log it in the app, the other guy taps to accept — that's what makes it official. Settle it when it's decided. Shows up in your running total.

**HOW TIES GET BROKEN**

Never in the app. If the automatic tiebreakers (points, head-to-head, holes won) still leave it dead even — for the Cup, the individual title, or Sunday's pairings — it comes down to a chip-off. Grab a wedge.

---

## Scope — Part C: Accuracy pass

- Before finalizing, cross-check every rule above against `PRODUCT_SPEC.md`, `GUI_INVITATIONAL_RULEBOOK.md` v1.6, and `PRODUCT_SPEC_ADDENDUM_A.md`. If anything conflicts, flag it in the addendum rather than silently resolving it — Chris should see and confirm any discrepancy found.

---

## Verification

1. Screen reachable from main nav, renders correctly on mobile.
2. Every section from Part B present, collapsible, readable one-handed.
3. Spot-check at least 3 rules against the canonical docs for accuracy (reverse mulligan's two-score exception, skins cross-round carryover, chip-off-not-ties policy — the three most nuanced/recently-changed rules).
4. No regression: nav, other screens, engine tests unaffected (this is a pure content/UI addition, no engine involvement).

## Close-out

Session addendum (shipped / commits / any accuracy discrepancies found in Part C), to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md` — closes the Rulebook screen item from the punch list.
