# THE GUI INVITATIONAL — RULEBOOK

**Companion to:** GUI Invitational Product Spec v1.1 (the spec governs the app build; this governs the trip)
**Event:** Year 1 · March 26–28, 2027
**Version:** 1.6

---

## 1. The weekend

| When | What |
|---|---|
| **~Fri Mar 12** (2 weeks out) | **Captain Draw** — the 4 captains drawn at random, announced in the group chat. Trash talk officially begins. |
| **Fri Mar 26 — afternoon** | **Fun round.** Loose golf, no app, no stakes — and everyone's quietly scouting form for that night's draft. |
| **Fri Mar 26 — night** | **Draft Night** at the house. Three acts, run offline — Chris plugs the results into the app after. |
| **Sat Mar 27** | **Round 1 — Shamble.** Drawn matchups. 12 points on the course. |
| **Sun Mar 28** | **Round 2 — Four-ball finale.** Earned pairings (1st vs 2nd, 3rd vs 4th). Early tee times so the cup is decided before departures. Trophy ceremony. 12 points on the course. |

---

## 2. Captains

- **4 captains, drawn at random** from the 16 — anyone can get the clipboard.
- Drawn ~2 weeks before the trip, in the group chat. The app isn't involved.
- The captain's job: make 3 draft picks, then set his duos each competitive round. That's it — no other duties, no politics.

---

## 3. Draft Night — three acts

**Act I — Pick-order draw.** The 4 captains' draft order is drawn at random, live. Full chaos by design.

**Act II — The snake draft.** Order runs 1-2-3-4 / 4-3-2-1 / 1-2-3-4. Three picks per captain → 4 teams of 4. Full handicap board visible to the room the entire time — this draft is about balance and theater, not secrecy. Run it on a whiteboard, poster board, or the back of a scorecard — the app sits this one out.

**Act III — Day 1 matchup draw.** Which team faces which on Saturday, drawn live as the closing moment. Everyone walks out of night one knowing who they play in the morning.

After the room clears, Chris enters the four teams, captains, and Saturday's matchups into the app — the leaderboard is live by morning.

---

## 4. Duos — the captain's strategy layer

- Before each competitive round, each captain privately submits his two duos in the app and designates them **Duo A** and **Duo B**.
- Submissions are **blind** — the app reveals both teams' duos simultaneously once both captains commit (deadline: 30 minutes before the first tee time).
- Matches slot automatically: your Duo A plays their Duo A; B plays B. Guessing where the other captain hides his best pairing is the game within the game.
- Captains may keep or reshuffle duos between Saturday and Sunday — lineup changes for the finale are fair game.

---

## 5. The competition (fixed in Charter v1.1 — summary)

- Duo vs duo match play. Every match worth **3 points**: front 9, back 9, overall 18 (win = 1, halve = ½). 12 points per day, **24 total** — most cumulative points wins the cup.
- **Saturday — Shamble:** both duo members tee off, play from the best drive, both hole out their own ball; best net ball counts.
- **Sunday — Four-ball:** own ball throughout; best net ball counts. Pairings earned: 1st place plays 2nd, 3rd plays 4th.
- **Individual race:** cumulative individual net across both competitive rounds, running automatically. Every shot counts twice.
- **Handicaps:** net play. GHIN index where available, assigned trip index otherwise — **collected by Chris the week of the trip** and entered in admin. The app converts every index to a **course handicap for that day's course and tees** (rating, slope, par, and stroke index loaded per round) and shows each player his strokes and exactly which holes they fall on. Nobody does math — your dots are just on the card. Commissioner may adjust any trip index between rounds.
- **Do-overs:** each player gets **one breakfast ball** (first tee shot of the round only) and **one mulligan** (any shot except on the putting green) per competitive round. The second ball must be played. Use them or lose them — nothing carries to the next round. The resulting score counts for everything: match, individual race, skins. Scorekeeper marks usage in the app.
- **Reverse mulligan — the team weapon:** once per round, each **team** may force an opposing player to **replay any one shot** — tee shot, approach, chip, or putt — in one of its duo matches. Must be called immediately, before the next shot is played — otherwise it's waived. The player re-hits that single shot and plays on from the result; **he does not play two balls**. One per team, not per duo: either duo can burn it, and the app shows both foursomes live whether it's still in the holster. The replay counts for the duo match. **The one exception — a made shot stays made:** if the reversed shot was already holed (e.g. a drained putt), it still counts at its real value for skins and the individual race, even though the team match must honor the replay. So a reverse mulligan on a holed putt sabotages the *team* result while leaving the player's own money game and personal score intact. Every other reverse mulligan produces a single score that counts everywhere. Scorekeeper records the replay result — and, only when a holed shot was reversed, both scores on that hole.

---

## 6. Money (fixed in Charter v1.1 — summary)

- **Gross skins**, optional entry each competitive round — every player opts in or out in the app before the round's first tee (buy-in TBD). Lowest raw score **among entrants** outright wins the hole, carryovers on ties. Non-entrants are invisible to skins: their scores neither win nor block. Zero math, maximum reward.
- **The Challenge Ledger** — any player can log a bet against any other, any time; the other taps accept to make it official; winner marked, amount hits the ledger. Absorbs every side game invented on the trip.
- Nothing else. No cup pot — the cup is played for the trophy and the champions wall.
- One settle-up number per man at trip's end.

---

## 7. Contingencies

- **Shortened event:** if Sunday cannot be completed (departures, weather), the cup and individual title go to the standings after the last fully completed round. Pre-decided — no bar-side rulings.
- **Commissioner authority:** Chris resolves anything not covered here — score corrections, handicap adjustments, Challenge Ledger disputes, rule gaps. Rulings are final and entered through admin.
- Fine-grained edges (tiebreaker ladder, handicap allowances per format, skins edge rules, Challenge Ledger void rules, reverse mulligan edge rules) are resolved by Chris with the architect and encoded before M2 (Spec §5).

---

## 8. Still to lock

- ✅ Roster locked — 16 names in PRODUCT_SPEC §6. Indexes collected trip week.
- Sunday departure picture → confirm early tee-time window.
- Course(s), tee times, and tee selection for all three rounds (scorecard data loads into the app once known).
- Exact Captain Draw date and skins buy-in amount.
