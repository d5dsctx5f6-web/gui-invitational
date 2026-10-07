import { describe, expect, it } from "vitest";
import {
  canRecordChipOff,
  cupHeadline,
  cupStandings,
  matchCardStatus,
  projectedStandings,
  type CupInput,
  type CupMatchInput,
} from "./cup";
import { buildMatchHoles } from "./scoring";
import { computeMatchState } from "./matchState";
import { bestBallScores, QA_SCENARIOS, scrambleScores, type MatchScript, type QaScenario } from "./fixtures/qaScenarios";
import { OODHAM_GOLD, SAGUARO_PURPLE } from "./fixtures/courses";

const PARS = [OODHAM_GOLD.parByHole, SAGUARO_PURPLE.parByHole];

/** Builds one match's holes from a script, in either format (the adapter is the same one the app uses). */
function holesFor(script: string, par: number[], format: "scramble" | "best_ball") {
  if (format === "scramble") {
    return buildMatchHoles({
      format,
      parByHole: par,
      duoAId: "A",
      duoBId: "B",
      scrambleRows: scrambleScores(script, par).flatMap((r) => [
        { duoId: "A", hole: r.hole, strokes: r.a },
        { duoId: "B", hole: r.hole, strokes: r.b },
      ]),
    });
  }
  return buildMatchHoles({
    format,
    parByHole: par,
    duoAId: "A",
    duoBId: "B",
    bestBallRows: bestBallScores(script, par).flatMap((r) => [
      { duoId: "A", playerId: "a1", hole: r.hole, strokes: r.a[0] },
      { duoId: "A", playerId: "a2", hole: r.hole, strokes: r.a[1] },
      { duoId: "B", playerId: "b1", hole: r.hole, strokes: r.b[0] },
      { duoId: "B", playerId: "b2", hole: r.hole, strokes: r.b[1] },
    ]),
  });
}

function inputFor(
  s: QaScenario,
  round2: "scramble" | "best_ball",
  over: Partial<Pick<CupInput, "eventShortened" | "chipOffWinner">> = {},
): CupInput {
  const formats = ["scramble", round2] as const;
  return {
    eventShortened: over.eventShortened ?? s.eventShortened,
    chipOffWinner: over.chipOffWinner ?? null,
    rounds: s.rounds.map((slots, ri) => ({
      roundId: `r${ri + 1}`,
      roundNumber: ri + 1,
      matches: slots.flatMap<CupMatchInput>((script: MatchScript, si) =>
        script === null ? [] : [{ slot: si + 1, holes: holesFor(script, PARS[ri], formats[ri]) }],
      ),
    })),
  };
}

describe.each(QA_SCENARIOS)("scenario $id — $name", (scenario) => {
  for (const round2 of ["scramble", "best_ball"] as const) {
    it(`pinned Cup result (round 2 ${round2})`, () => {
      const c = cupStandings(inputFor(scenario, round2));
      const e = scenario.expected;
      expect(c.official).toEqual(e.official);
      expect(c.holesWon).toEqual(e.holesWon);
      expect(c.possiblePoints).toBe(e.possiblePoints);
      expect(c.pointsToWin).toBe(e.pointsToWin);
      expect(c.clinched).toBe(e.clinched);
      expect(c.final).toBe(e.final);
      expect(c.chipOffRequired).toBe(e.chipOffRequired);
      expect(c.winner).toBe(e.winner);
      expect(c.leaderBasis).toBe(e.leaderBasis);
      expect(c.banner).toBe(e.banner);
      expect(c.countedRoundNumbers).toEqual(e.countedRoundNumbers);
      if (e.projectedTotal) {
        const p = projectedStandings(inputFor(scenario, round2));
        expect(p.projectedTotal).toEqual(e.projectedTotal);
      }
    });
  }
});

describe("possible points come from the matches that exist, never a constant", () => {
  it("21 with a three-match Sunday, 24 with four, 12 when only one round has duos", () => {
    const s5 = QA_SCENARIOS[4];
    expect(cupStandings(inputFor(s5, "scramble")).possiblePoints).toBe(21);
    expect(cupStandings(inputFor(QA_SCENARIOS[0], "scramble")).possiblePoints).toBe(24);
    const satOnly = inputFor(QA_SCENARIOS[0], "scramble");
    satOnly.rounds = [satOnly.rounds[0], { ...satOnly.rounds[1], matches: [] }];
    const c = cupStandings(satOnly);
    expect(c.possiblePoints).toBe(12);
    expect(c.pointsToWin).toBeNull(); // Sunday could still add up to 12: no target, so no clinch either
    expect(c.clinched).toBeNull();
    expect(c.pairingsPending).toBe(true);
    expect(c.banner).toBe("pairings_pending");
    expect(c.final).toBe(false);
  });

  it("points to win is possible/2 + 1/2: 12.5 of 24, 11 of 21, 6.5 of 12, 1.5 of 3", () => {
    const ptw = (n: number) => {
      const scripts = Array(n).fill(HALVED_SCRIPT);
      const c = cupStandings({
        eventShortened: false,
        chipOffWinner: null,
        rounds: [{ roundId: "r1", roundNumber: 1, matches: scripts.map((sc, i) => ({ slot: i + 1, holes: holesFor(sc, PARS[0], "scramble") })) }],
      });
      return c.pointsToWin;
    };
    expect([ptw(8), ptw(7), ptw(4), ptw(1)]).toEqual([12.5, 11, 6.5, 2]);
  });

  it("nothing in play means no target at all", () => {
    expect(cupStandings({ eventShortened: false, chipOffWinner: null, rounds: [] }).pointsToWin).toBeNull();
  });
});
const HALVED_SCRIPT = "H".repeat(18);

describe("shortened event is the commissioner's call, never automatic", () => {
  const s4 = QA_SCENARIOS[3];

  it("declared: only Saturday counts and the banner says shortened", () => {
    const c = cupStandings(inputFor(s4, "scramble"));
    expect(c.countedRoundNumbers).toEqual([1]);
    expect(c.banner).toBe("shortened");
    expect(c.official).toEqual({ a: 7.5, b: 4.5 });
    expect(c.rounds[1].counts).toBe(false);
  });

  it("NOT declared: same scores, both rounds count, no banner, event still live", () => {
    const c = cupStandings(inputFor(s4, "scramble", { eventShortened: false }));
    expect(c.countedRoundNumbers).toEqual([1, 2]);
    expect(c.banner).toBeNull();
    expect(c.final).toBe(false);
    expect(c.possiblePoints).toBe(24);
    expect(c.winner).toBeNull();
  });

  it("declared with Saturday also unfinished: nothing counts, nothing is final", () => {
    const input = inputFor(QA_SCENARIOS[5], "scramble", { eventShortened: true });
    input.rounds[0].matches = input.rounds[0].matches.slice(0, 2).map((m) => ({ ...m, holes: holesFor("AAA", PARS[0], "scramble") }));
    const c = cupStandings(input);
    expect(c.countedRoundNumbers).toEqual([]);
    expect(c.final).toBe(false);
    expect(c.winner).toBeNull();
  });
});

describe("tiebreak ladder: points, then holes won, then chip-off — never auto-resolved", () => {
  it("level on points, so total holes won decides", () => {
    // North 3-0 on a thin win (10 holes), a halved match, South 3-0 on a sweep (18 holes): points are
    // level at 4.5 each, so holes won decide it for South.
    const c = cupStandings({
      eventShortened: false,
      chipOffWinner: null,
      rounds: [
        {
          roundId: "r1",
          roundNumber: 1,
          matches: [
            { slot: 1, holes: holesFor("AAAAAHHHHAAAAAHHHH", PARS[0], "scramble") }, // A 3-0, A holes 10
            { slot: 2, holes: holesFor("H".repeat(18), PARS[0], "scramble") }, // 1.5-1.5
            { slot: 3, holes: holesFor("B".repeat(18), PARS[0], "scramble") }, // B 3-0, B holes 18
          ],
        },
      ],
    });
    expect(c.official).toEqual({ a: 4.5, b: 4.5 }); // level on points...
    expect(c.holesWon.b).toBeGreaterThan(c.holesWon.a); // ...so holes decide: South
    expect(c.leader).toBe("B");
    expect(c.leaderBasis).toBe("holes");
  });

  it("POINTS come before holes won: the points leader wins even with far fewer holes", () => {
    // Found by search, then pinned. South leads 5-4 on points while North won 25 holes to South's 14.
    // (A tiebreak that looked at holes first would crown North.)
    const southOnPoints = cupStandings({
      eventShortened: false,
      chipOffWinner: null,
      rounds: [
        {
          roundId: "r1",
          roundNumber: 1,
          matches: ["AHAAAAAAAAAAAAHAAB", "AABHBBBHAABHAHAHBB", "HAHBHHBBHHAHBABBHA"].map((script, i) => ({
            slot: i + 1,
            holes: holesFor(script, PARS[0], "scramble"),
          })),
        },
      ],
    });
    expect(southOnPoints.official).toEqual({ a: 4, b: 5 });
    expect(southOnPoints.holesWon).toEqual({ a: 25, b: 14 });
    expect(southOnPoints.leader).toBe("B");
    expect(southOnPoints.leaderBasis).toBe("points");

    // and the mirror image: North leads 5-4 on points while South won 25 holes to 19
    const northOnPoints = cupStandings({
      eventShortened: false,
      chipOffWinner: null,
      rounds: [
        {
          roundId: "r1",
          roundNumber: 1,
          matches: ["BBABBAABBBBBBBBBBH", "ABBBBBHAAHAHBAAAAB", "BBAAHHHAABAHHAAHBA"].map((script, i) => ({
            slot: i + 1,
            holes: holesFor(script, PARS[0], "scramble"),
          })),
        },
      ],
    });
    expect(northOnPoints.official).toEqual({ a: 5, b: 4 });
    expect(northOnPoints.holesWon).toEqual({ a: 19, b: 25 });
    expect(northOnPoints.leader).toBe("A");
    expect(northOnPoints.leaderBasis).toBe("points");
  });

  it("level on points AND holes: chip-off is flagged, never auto-resolved", () => {
    const s3 = cupStandings(inputFor(QA_SCENARIOS[2], "scramble"));
    expect(s3.chipOffRequired).toBe(true);
    expect(s3.leader).toBeNull();
    expect(s3.winner).toBeNull();
  });

  it("a recorded chip-off winner becomes the winner and the banner says so", () => {
    const rec = cupStandings(inputFor(QA_SCENARIOS[2], "scramble", { chipOffWinner: "B" }));
    expect(rec.chipOffRequired).toBe(false);
    expect(rec.winner).toBe("B");
    expect(rec.banner).toBe("chip_off_recorded");
  });

  it("level scores mid-event are just a tied match, not a chip-off", () => {
    const c = cupStandings({
      eventShortened: false,
      chipOffWinner: null,
      rounds: [{ roundId: "r1", roundNumber: 1, matches: [{ slot: 1, holes: holesFor("HHH", PARS[0], "scramble") }] }],
    });
    expect(c.chipOffRequired).toBe(false);
    expect(c.final).toBe(false);
  });
});

describe("projection is display-only and never mixed into official points", () => {
  it("scenario 6: official stays 8.5-4.5 while 'if it ended now' is 10.5-7.5", () => {
    const input = inputFor(QA_SCENARIOS[5], "scramble");
    const p = projectedStandings(input);
    expect(p.official).toEqual({ a: 8.5, b: 4.5 });
    expect(p.projectedExtra).toEqual({ a: 2, b: 3 });
    expect(p.projectedTotal).toEqual({ a: 10.5, b: 7.5 });
    // and the standings function itself never sees the projection
    expect(cupStandings(input).official).toEqual({ a: 8.5, b: 4.5 });
  });

  it("projects nothing for finished or not-started matches", () => {
    const done = projectedStandings(inputFor(QA_SCENARIOS[0], "scramble"));
    expect(done.projectedExtra).toEqual({ a: 0, b: 0 });
    const none = projectedStandings({
      eventShortened: false,
      chipOffWinner: null,
      rounds: [{ roundId: "r1", roundNumber: 1, matches: [{ slot: 1, holes: holesFor("", PARS[0], "scramble") }] }],
    });
    expect(none.projectedExtra).toEqual({ a: 0, b: 0 });
  });

  it("a segment that is up projects as a win, all square as a halve", () => {
    const up = projectedStandings({
      eventShortened: false, chipOffWinner: null,
      rounds: [{ roundId: "r1", roundNumber: 1, matches: [{ slot: 1, holes: holesFor("AA", PARS[0], "scramble") }] }],
    });
    expect(up.projectedExtra).toEqual({ a: 2, b: 0 }); // front 9 and overall 18 both North
    const level = projectedStandings({
      eventShortened: false, chipOffWinner: null,
      rounds: [{ roundId: "r1", roundNumber: 1, matches: [{ slot: 1, holes: holesFor("HH", PARS[0], "scramble") }] }],
    });
    expect(level.projectedExtra).toEqual({ a: 1, b: 1 });
  });
});

describe("matchCardStatus", () => {
  const status = (script: string) => matchCardStatus(computeMatchState(holesFor(script, PARS[0], "scramble")));

  it("not started, live (up / all square), a 9 still live, and finals", () => {
    expect(status("")).toEqual({ state: "not_started", status: "Not started", final: null });
    expect(status("AAAAAAAA")).toMatchObject({ state: "live", status: "N 8 UP thru 8" });
    expect(status("HHHHHH")).toMatchObject({ state: "live", status: "AS thru 6" });
    expect(status("BBB")).toMatchObject({ state: "live", status: "S 3 UP thru 3" });
    expect(status("A".repeat(18))).toEqual({ state: "final", status: "N wins 3–0", final: "N wins 3–0" });
    expect(status("B".repeat(18)).final).toBe("S wins 3–0");
    expect(status("H".repeat(18)).final).toBe("Halved 1½–1½");
  });

  it("18 decided while a 9 is live shows that, not a final", () => {
    const s = status("AAAAAAAAA" + "AAAAAAAAAA".slice(0, 2)); // North 11 up after 11: overall decided early
    expect(s.state).toBe("live");
    expect(s.status).toMatch(/N won 18/);
  });
});

describe("cupHeadline wording", () => {
  const head = (i: number, over: Partial<Pick<CupInput, "eventShortened" | "chipOffWinner">> = {}) =>
    cupHeadline(cupStandings(inputFor(QA_SCENARIOS[i], "scramble", over)));

  it("12½ to win of 24, 11 to win of 21, and the progress line carries the possible total", () => {
    expect(head(0).toWin).toBe("12½ to win");
    expect(head(4).toWin).toBe("11 to win");
    expect(head(0).progress).toBe("24 of 24 points decided");
    expect(head(4).progress).toBe("21 of 21 points decided"); // short-handed Sunday: 21 possible, not 24
    expect(head(5).progress).toBe("13 of 24 points decided"); // mid-round: 12 (Saturday) + 1 (Sunday's closed front 9)
    expect(head(3).progress).toBe("12 of 12 points decided"); // shortened: only Saturday counts
  });

  it("'win the Cup' (Year 1: nobody to retain), with how it was won", () => {
    expect(head(0).line).toBe("North Hedges win the Cup");
    expect(head(1).line).toBe("North Hedges win the Cup (on holes won)");
    expect(head(3).line).toBe("North Hedges win the Cup — shortened event");
  });

  it("chip-off wording, then the recorded winner", () => {
    expect(head(2).line).toMatch(/^Chip-off required/);
    expect(head(2, { chipOffWinner: "B" }).line).toBe("South Hedges win the Cup (chip-off)");
  });

  it("live and unpaired: no 'to win' until every round has duos", () => {
    const pending = inputFor(QA_SCENARIOS[0], "scramble");
    pending.rounds = [pending.rounds[0], { ...pending.rounds[1], matches: [] }];
    const h = cupHeadline(cupStandings(pending));
    expect(h.toWin).toBeNull();
    expect(h.line).toBe("Pairings pending");
    expect(head(5).toWin).toBe("12½ to win");
    expect(head(5).line).toBeNull(); // mid-event, nobody clinched, no banner
  });

  it("clinched mid-event says clinched, not 'win'", () => {
    const live = inputFor(QA_SCENARIOS[0], "scramble");
    live.rounds[1].matches = live.rounds[1].matches.slice(0, 3); // North 15 already, Sunday match 4 unplayed? keep final=false:
    live.rounds[1].matches[2] = { ...live.rounds[1].matches[2], holes: holesFor("AAA", PARS[1], "scramble") };
    const c = cupStandings(live);
    expect(c.final).toBe(false);
    expect(cupHeadline(c).line).toBe("North Hedges have clinched the Cup");
  });
});

describe("canRecordChipOff — the server-side guard", () => {
  const can = (i: number, over: Partial<Pick<CupInput, "eventShortened" | "chipOffWinner">> = {}) =>
    canRecordChipOff(cupStandings(inputFor(QA_SCENARIOS[i], "scramble", over))).ok;

  it("allowed only on a genuine, unrecorded chip-off (scenario 3)", () => {
    expect(can(2)).toBe(true);
  });

  it("refused for a normal finish, a holes-won tiebreak, a shortened finish, a live event and a short-handed finish", () => {
    for (const i of [0, 1, 3, 4, 5]) expect(can(i)).toBe(false);
  });

  it("refused once a winner is already recorded (it must be cleared first)", () => {
    expect(can(2, { chipOffWinner: "A" })).toBe(false);
  });

  it("refused while the event is still live and level", () => {
    const live = cupStandings({
      eventShortened: false,
      chipOffWinner: null,
      rounds: [{ roundId: "r1", roundNumber: 1, matches: [{ slot: 1, holes: holesFor("HHH", PARS[0], "scramble") }] }],
    });
    expect(canRecordChipOff(live).ok).toBe(false);
  });
});
