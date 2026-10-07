# THE HEDGES INVITATIONAL — PRODUCT SPEC

**Supersedes:** Product Spec v1.0 + Addendum A, built as "The GUI Invitational" (four-team / shamble-four-ball format retired in full; event renamed)
**Builder:** Chris + Claude Code · **Architect:** Claude.ai (this project)
**Event:** The Hedges Invitational — Year 1 of an annual franchise · **Trip:** Fri Mar 26 – Sun Mar 28, 2027
**Spec version:** 2.0 — major structural redesign + rename, Aug 2026

---

## 1. The product

A live-scoring app that runs a 16-man golf trip: two teams, duo scramble match play, a live pairings-night draft before each round, the Challenge Ledger, schedule, and a champions wall. Pure standalone software — no AI at runtime.

**What changed from v1.0, in one paragraph:** four teams became two. Shamble Saturday / four-ball Sunday became one format — 2-man scramble, gross, both days. Blind simultaneous duo submissions became a live, sequential declare-and-counter draft the night before each round. Gross skins is retired; the Challenge Ledger is now the sole money layer, with one-tap bet presets replacing it. The individual net race is retired, replaced by Drives Used — a single tap, no scoring weight. Net scoring, handicap allowances, do-overs (breakfast ball / mulligan), and the reverse-mulligan two-score rule are all retired. Handicaps are now display-only — captain intel, not a scoring input.

---

## 2. Competition spec (canonical — the engine implements exactly this)

### Players, captains, teams
- 16 players (roster locked — §6), split into **two 8-man teams: North Hedges and South Hedges** — named for MSU's twin residence halls, a fixed identity every year.
- **Two captains, drawn at random** ~2 weeks out, then randomly assigned one to North, one to South. Teams are formed via an **offline snake draft** the captains run themselves — the app plays no role in team formation, reveals, or timers, exactly as v1.0 already specified. Chris enters the two finished rosters via admin once the draft is done.
- **The North/South identity is permanent; the rosters are not.** Every year: new captain draw, new random North/South assignment, new snake draft, entirely fresh 8-man rosters on both sides. Nobody "is" North Hedges or South Hedges from year to year — the rivalry is the constant, not the roster. The champions wall records which side won each year and who was on it.

### Rounds & format
- **2 competitive rounds**, Saturday and Sunday. (Friday fun round = itinerary only; the scoring engine never touches it.)
- **Format is set per round** (admin switch, default scramble; Saturday is always scramble). Duo vs duo match play, gross, in either format:
  - **Scramble:** both partners tee off; the duo plays the better ball; both play in from there. One score per duo per hole.
  - **Best ball (optional, Sunday only in practice):** each player plays his own ball; the duo's hole score is the **lowest raw score** of its two players. A player who picks up is left blank; a duo needs at least one score to post the hole.
  - **The format locks at the first posted score** for that round (database-enforced). The rulebook requires the commissioner to announce Sunday's format before Pairings Night II.
- Each round: 8 vs 8, **four duo-vs-duo matches** running as four simultaneous foursomes.

### Pairings Night — the live declare-and-counter draft
Runs twice per trip: **Friday night** (sets Saturday's four matches) and **Saturday night** (sets Sunday's). Commissioner-operated — Chris runs a screen-shared board while captains call picks out loud in the room; every player's phone gets the same board pushed live via realtime.

- **Coin flip once, before Friday's pairings night.** The winner chooses to declare first or counter first.
- **Three declare-and-counter cycles** set three of the four matches: the declaring captain names one of his duos; the countering captain answers with a duo of his own to face them — that's a match. Roles alternate each cycle.
- **Match 4 is forced.** After three cycles, each side has exactly two players left; the board locks them in automatically — no declare, no counter.
- **Sunday's order reverses Friday's automatically** — no second coin flip. Whoever countered first on Friday (the advantaged seat: you pick knowing their duo) declares first on Sunday.
- Duos aren't fixed across the weekend. A captain can run back Friday's pairs or reshuffle entirely for Sunday.

### Points
- Every duo match = **3 points: front 9, back 9, overall 18** (win 1, halve ½). 12 points/round, **24 total**; most cumulative points wins the cup. *(Unchanged from v1.0 — the math doesn't care how the duos got there.)*
- **Shortened event:** if Sunday can't complete, the cup goes to standings after the last fully completed round.

### Handicaps — display only
- **No strokes given, anywhere.** Gross scramble, straight up, both days.
- Index (GHIN where a player has one, assigned trip index otherwise) is visible to both captains on the Pairings Night board — Ryder Cup style intel for matchmaking. It computes into nothing downstream; it's shown, not scored.

### Mercy rule — double bogey cap
- No duo score counts higher than **par + 2** in match state (in best ball, the cap applies to the duo's counting score; capping each ball then taking the lower equals taking the lower then capping). A scorekeeper can enter whatever the duo actually made on a disaster hole; the engine caps the number that's used for match play. Nothing else in the app reads a raw over-cap score, so this is a pace/match rule only — store the real number, cap it once, at computation.

### Reverse mulligan — one per duo per round
- Each duo gets **one reverse mulligan per round** (one per duo, per round): force the opposing duo to replay their last shot in that match. Must be called immediately, before the next shot is played, or it's waived.
- Whatever the duo makes on the replay **is the score.** No two-score rule, no divergent tracking. In best ball the replayed shot belongs to one opposing player, and his replay result is simply his score for the hole.

### Drives Used
- **Scramble rounds only** (hidden in best ball, where everyone plays his own drive). One optional tap per duo per hole: which partner's tee shot the duo played. All 18 holes, par 3s included. Purely informational — feeds a "who carried" leaderboard. Never touches match state, points, or money.

### Money — Challenge Ledger only
- **The Challenge Ledger is the sole money mechanism.** Any player logs a bet against any other (parties, stake, plain-words terms); the counterparty taps accept to make it official; winner marked, amount hits the ledger. Admin can resolve or void.
- **One-tap bet presets:** a short menu of the trip's standing bets so logging one is a tap and a name, not typing terms from scratch. Final preset list is a ledger-brief decision, not a spec decision.
- Nothing else. No skins, no cup pot. Running ledger per player; **one settle-up number per man** at trip's end. The app tracks money; it never moves money.

### The Cup screen, the "If it ended now" projection, and the TV board
- **`/leaderboard`** shows North v South official points, "X to win" (the smallest total above half of the points possible: 12½ of 24, 11 of 21 — **possible points always come from the matches that exist, never a constant**), a clinch/winner line ("North Hedges win the Cup"), per-round "N of M points decided", and four match cards per round with live F9/B9/18 chips. A read-only match detail shows the neutral hole strip (team-colored), each duo's counting score, where the mercy cap changed a hole, reverse mulligan calls and (scramble) Drives Used.
- **"If it ended now"** is a labeled projection only: official points plus every in-progress segment projected at its current status (up = a win, all square = a halve). It is **display only and never mixed into the official total**.
- **Before pairings:** until every round has duos the header says "Pairings pending" and shows no "to win" line and no clinch (the true possible total isn't known yet).
- **Round complete** = it has matches and every match has all three segments decided (an early close counts).
- **Shortened event** applies only when the commissioner **declares** it (`seasons.event_shortened`, with confirm and undo): the Cup is then decided on the standings after the last fully completed round, and later rounds are shown as "not counted". It is never inferred from an incomplete round.
- **Tiebreak:** points → total holes won (every posted hole counts, so play all 18 and post every hole) → "chip-off required" (never auto-resolved; the commissioner records the winner, which can be cleared).
- **`/board`** is the TV version of the big board: landscape, large type, no scrolling at 1080p, no login, read-only, no admin links, dark by default with a light toggle, realtime plus a 30-second refetch fallback and a visible "LIVE / NOT LIVE" clock.

### Scorekeeping
- **Any of the four players in a match can post or edit both duos' scores for that match, and log either duo's reverse mulligan call.** Whoever has a phone out does it; the signed paper card is the backup. Enforced by the database (RLS `can_score_duo()`), not just the UI.
- **Drives Used is prompted on every hole (scramble) but never required to post.**
- Undoing a reverse mulligan call, deleting scores, and changing a locked format are commissioner-only, through admin Corrections.

### Paper scorecards
> **Paper scorecards.** Every foursome carries a printed card and marks it each hole. The app is canonical for live scoring and standings. At the end of the round, both duos sign the card. If the signed card and the app disagree, the commissioner reconciles to the signed card through admin.

---

## 3. Beyond scoring

- **Schedule/itinerary:** tee times, dinners, the fun round, both Pairings Nights on the calendar.
- **Champions wall:** seasons/records are first-class from day one — Year 1 of an annual event. Records which two team names and captains played, and who won.
- **Admin (Chris):** total control — edit any score/event, index, roster, matchup, schedule item, buy-in; run Pairings Night; resolve disputes. Every commissioner power is an admin control.

---

## 4. Player experience principles (fixed, unchanged)

1. Complexity lives in the app, never in a player's head — a player knows two things: win your match, post your scores.
2. **One scorekeeper per foursome** enters hole-by-hole; the only on-course data entry.
3. **Zero-friction access**: fully in from a text link in under 30 seconds — no app store, no passwords.
4. **Live means live**: a posted hole reaches every phone within seconds.
5. Built for a phone in sunlight, one-handed, mid-round.

---

## 5. Open items

- Final one-tap bet preset list (Brief 34 — ledger).
- Rulebook screen copy for Pairings Night, mercy rule, and reverse mulligan (Brief 35).
- Reconciled a documentation drift while writing this version: v1.0's Rulebook described an in-app Captain Draw reveal and Draft Night TV board, while v1.0's own Product Spec §2 and the current BUILD_PLAN both say the draft runs fully offline with no in-app features. **v2.0 treats "fully offline, admin-entered" as canonical** for team formation — confirm this matches intent, since it means Draft Night gets no in-app screen at all, ever, only Pairings Night does.

## 6. Pending inputs (Chris supplies; stub cleanly, never hard-block)

- Course(s), tee times, tee selection — plus scorecard data per course (rating, slope, par, stroke index — for display only now, not scoring).
- 16-man roster: names, GHIN numbers or suggested trip indexes.
- Captain draw date confirmation. Sunday departure window.
- ~~Skins buy-in~~ — removed; skins is retired, no buy-in concept remains.

## 7. Hard constraints (unchanged)

1. **No AI at runtime** — standalone software; zero model calls; zero Greg dependencies.
2. **$0/month hosting** (free tiers), datacenter-hosted — never self-hosted on personal hardware.
3. Everything in one git repo a human can navigate cold; docs mirrored in `/docs`.
4. Milestones gate on **working demos in Chris's hands** (see BUILD_PLAN).
