import { describe, expect, it } from "vitest";
import { computeIndividualRace, type PlayerHoleNet } from "./individualRace";
import { computeMatchState, type DuoHoleNets } from "./matchState";
import { matchScore, netScore, realScore, type HoleScore } from "./netScore";
import { reverseMulliganStatus, type ReverseMulliganEvent } from "./reverseMulligan";
import { computeSkins, type SkinsHoleScore } from "./skins";

describe("the two-score rule: matchScore vs realScore", () => {
  it("null case: with no match_strokes anywhere, every consumer reads the same value", () => {
    const row: HoleScore = { strokes: 4 };
    expect(matchScore(row)).toBe(4);
    expect(realScore(row)).toBe(4);
  });

  it(
    "divergent case: one dataset, X real 3 / match 5 — duo match sees 5, " +
      "skins and individual see 3, simultaneously",
    () => {
      // Duo A: X (reverse-mulliganed: real 3, match 5) + teammate (no divergence, 6).
      // Duo B: two opponents, 4 and 7. No handicap dots in this fixture — isolates the
      // score-source divergence from handicap math, which is covered elsewhere.
      const x: HoleScore = { strokes: 3, matchStrokes: 5 };
      const teammate: HoleScore = { strokes: 6 };
      const opponent1: HoleScore = { strokes: 4 };
      const opponent2: HoleScore = { strokes: 7 };

      // --- Duo match state reads matchScore ---
      const holes: DuoHoleNets[] = [
        {
          hole: 1,
          duoANet: [netScore(matchScore(x), 0), netScore(matchScore(teammate), 0)],
          duoBNet: [
            netScore(matchScore(opponent1), 0),
            netScore(matchScore(opponent2), 0),
          ],
        },
      ];
      const matchState = computeMatchState(holes);
      // Duo A's best ball is X at match-score 5; Duo B's best is 4 -> B wins the hole.
      expect(matchState.front9.holesUp).toBe(-1);
      expect(matchState.front9.thru).toBe(1);

      // --- Skins reads realScore: X's real 3 is the outright low ---
      const skinsScores: SkinsHoleScore[] = [
        { playerId: "X", hole: 1, strokes: realScore(x) },
        { playerId: "teammate", hole: 1, strokes: realScore(teammate) },
        { playerId: "opponent1", hole: 1, strokes: realScore(opponent1) },
        { playerId: "opponent2", hole: 1, strokes: realScore(opponent2) },
      ];
      const skins = computeSkins(skinsScores, [
        "X",
        "teammate",
        "opponent1",
        "opponent2",
      ]);
      expect(skins.holes[0]).toEqual({ hole: 1, status: "won", winner: "X" });

      // --- Individual race reads realScore: X's cumulative net is 3, not 5 ---
      const individualEntries: PlayerHoleNet[] = [
        { playerId: "X", roundId: "R1", hole: 1, net: netScore(realScore(x), 0) },
      ];
      const individual = computeIndividualRace(individualEntries);
      expect(individual.standings).toEqual([
        { playerId: "X", cumulativeNet: 3, holesPlayed: 1 },
      ]);
    },
  );
});

describe("reverseMulliganStatus", () => {
  it("is available when no event exists for that team/round", () => {
    const events: ReverseMulliganEvent[] = [];
    expect(reverseMulliganStatus(events, "TeamA", "R1")).toEqual({
      available: true,
      usedOnHole: null,
    });
  });

  it("is burned once an event exists, and reflects the hole it was used on", () => {
    const events: ReverseMulliganEvent[] = [
      { teamId: "TeamA", roundId: "R1", hole: 11 },
    ];
    expect(reverseMulliganStatus(events, "TeamA", "R1")).toEqual({
      available: false,
      usedOnHole: 11,
    });
  });

  it("is keyed by team + round, not by match — same value from both of a team's foursomes", () => {
    const events: ReverseMulliganEvent[] = [
      { teamId: "TeamA", roundId: "R1", hole: 11 },
    ];
    // The function takes no match/slot argument at all, so "asked from Group 1" and
    // "asked from Group 2" are the same call — this just proves it's deterministic.
    const fromGroup1 = reverseMulliganStatus(events, "TeamA", "R1");
    const fromGroup2 = reverseMulliganStatus(events, "TeamA", "R1");
    expect(fromGroup1).toEqual(fromGroup2);
  });

  it("does not confuse a different team or round", () => {
    const events: ReverseMulliganEvent[] = [
      { teamId: "TeamA", roundId: "R1", hole: 11 },
    ];
    expect(reverseMulliganStatus(events, "TeamB", "R1").available).toBe(true);
    expect(reverseMulliganStatus(events, "TeamA", "R2").available).toBe(true);
  });
});
