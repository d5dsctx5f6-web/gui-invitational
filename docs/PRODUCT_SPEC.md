# GUI INVITATIONAL — PRODUCT SPEC

**Supersedes:** Build Charter v1.5 (all content carried forward; Greg execution framing removed)
**Builder:** Chris + Claude Code · **Architect:** Claude.ai (this project)
**Event:** The GUI Invitational — Year 1 of an annual franchise · **Trip:** Fri Mar 26 – Sun Mar 28, 2027
**Spec version:** 1.1

---

## 1. The product

A live-scoring app that runs a 16-man golf trip: teams, duo match play, points, individual race, skins, the Challenge Ledger, schedule, and a champions wall. Pure standalone software — no AI at runtime.

---

## 2. Competition spec (canonical — the engine implements exactly this)

### Players, captains, draft
- 16 players (roster locked — §6). **The draft happens outside the app**: captains drawn at random ~2 weeks out, snake draft Friday night of the trip, Day 1 matchup draw — all run offline per the Rulebook.
- The app's job: an **admin form** where Chris enters the four teams (names, captains, members) and Saturday's matchups after draft night. Leaderboard live by Saturday morning.
- No draft features are built — no boards, reveals, or timers.

### Rounds & formats
- **2 competitive rounds.** (Friday fun round = itinerary only; scoring engine never touches it.)
- Each round: two team-vs-team matchups; each team fields two duos; duo-vs-duo match play; four foursomes, all live matches.
- **Saturday — Shamble**, drawn matchups: both duo members tee off, play from the best drive, both hole out own ball; best net ball counts per hole.
- **Sunday — Four-ball finale**, earned pairings (**1st place plays 2nd, 3rd plays 4th** in the standings): own ball throughout; best net ball counts. Early tee times (departures).

### Duo submissions (captain's strategy layer)
- Before each round, each captain privately submits Duo A and Duo B in-app. **Blind**: revealed simultaneously once both captains commit; deadline 30 minutes before first tee. A plays A, B plays B. Duos may be reshuffled between rounds.

### Points
- Every duo match = **3 points: front 9, back 9, overall 18** (win 1, halve ½). 12 points/round, **24 total**; most cumulative points wins the cup.
- **Shortened event:** if Sunday can't complete, standings after the last fully completed round decide cup and individual title.

### Individual race
- Cumulative **individual net** across both competitive rounds, automatic. Daily low net recognized (no money).

### Handicaps — index in, course handicap out
- Net play. GHIN index where a player has one; **assigned trip index** (index-equivalent) where he doesn't. All entered/edited in admin. **Chris collects all 16 indexes the week of the trip and enters them manually** — the app needs no index data before then.
- Per round the app stores the course setup — **Course Rating, Slope, Par, per-hole stroke index** — and computes each player's course handicap: `Index × (Slope ÷ 113) + (Rating − Par)`, rounded. Format allowances (open item §5) then produce playing handicap.
- **Dots land automatically** per stroke index; match scoring and individual net read from there. Players never do math.
- Default one tee set for all 16 per round; per-player tees supported (formula equalizes). Commissioner may adjust any trip index between rounds.

### Do-overs
- Per player per competitive round: **one breakfast ball** (first tee shot only) and **one mulligan** (any shot except on the putting green). Second ball must be played; no carryover. Resulting score counts everywhere — match, individual, skins. Scorecard UI tracks usage.

### Reverse mulligan (team weapon)
- **One per team per round**: force an opposing player to replay a shot in one of the team's duo matches. Called immediately, before the next shot, or waived. Either duo can burn it — availability must display **live in both of that team's foursomes**.
- **Two-score rule:** replay counts for the duo match; if the reversed shot was holed, the player's original score stands for skins and the individual race. Data model: a hole may carry a match score and a separate real score per player — match engine reads one; skins/individual read the other. Scorekeeper flow: tap RM → select victim → enter both scores if they diverge.

### Money — two mechanisms only
- **Gross skins, opt-in per round**: each player opts in/out in-app before the round's first tee; buy-in TBD (admin). Pot = entrants × buy-in. Lowest raw score **among entrants** outright wins; ties carry over. Non-entrants' scores neither win nor block.
- **Challenge Ledger**: any player logs a bet vs any other (parties, stake, plain-words terms); counterparty taps accept to make it official; winner marked; amount hits the ledger. Admin can resolve/void. Absorbs every invented side game.
- Nothing else. No cup pot. Running ledger per player; **one settle-up number per man** at trip's end. The app tracks money; it never moves money.

---

## 3. Beyond scoring

- **Schedule/itinerary**: tee times, dinners, the fun round.
- **Champions wall**: seasons/records are first-class from day one — Year 1 of an annual event.
- **Admin (Chris)**: total control — edit any score/event, handicap, team, matchup, schedule item, toggle, buy-in; resolve disputes. Every commissioner power is an admin control. Teams, captains, and matchups are entered here after offline draft night.

---

## 4. Player experience principles (fixed)

1. Complexity lives in the app, never in a player's head — a player knows two things: win your match, post your scores.
2. **One scorekeeper per foursome** enters hole-by-hole; the only on-course data entry.
3. **Zero-friction access**: fully in from a text link in under 30 seconds — no app store, no passwords.
4. **Live means live**: a posted hole reaches every phone within seconds.
5. Built for a phone in sunlight, one-handed, mid-round.

---

## 5. Open spec items (resolve with architect before M2 gate)

- Tiebreaker ladder: Saturday-standings seeding ties, final cup, individual title.
- Handicap allowance % per format (shamble, four-ball).
- Skins edges: paid nightly vs cross-round carry; any natural-birdie rules.
- Challenge Ledger edges: acceptance window, void conditions, disputes.
- Reverse mulligan edges: interaction with do-overs, exact timing window, non-holed cases.

## 6. Roster & pending inputs

**Roster — locked (16):** Chris Deliso · CJ Lambrecht · Spencer Petersen · Will Petersen · Matt Lacko · Zac Jones · Matt Hornbecker · Andrew Sabia · Brendan Gleason · Ian Hastings · Ben Meier · Tucker Gill · Cam Delaney · Dominic Ikeler · Grant Brogan · Rory Makohin

Still pending (Chris supplies; stub cleanly, never hard-block):
- Handicap indexes: collected by Chris the week of the trip, entered manually in admin.
- Teams, captains, Saturday matchups: entered in admin after offline draft night (Mar 26).
- Course(s), tee times, tee selection — plus scorecard data per course (rating, slope, par, stroke index).
- Skins buy-in. Sunday departure window.

## 7. Hard constraints

1. **No AI at runtime** — standalone software; zero model calls; zero Greg dependencies.
2. **$0/month hosting** (free tiers), datacenter-hosted — never self-hosted on personal hardware.
3. Everything in one git repo a human can navigate cold; docs mirrored in `/docs`.
4. Milestones gate on **working demos in Chris's hands** (see BUILD_PLAN).
