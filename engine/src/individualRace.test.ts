import { describe, expect, it } from "vitest";
import {
  computeIndividualRace,
  type PlayerHoleNet,
} from "./individualRace";
import { matchScore, netScore, realScore } from "./netScore";

describe("computeIndividualRace", () => {
  it("sums cumulative net across two rounds for a hand-checked player", () => {
    const entries: PlayerHoleNet[] = [
      { playerId: "A", roundId: "R1", hole: 1, net: 4 },
      { playerId: "A", roundId: "R1", hole: 2, net: -1 },
      { playerId: "A", roundId: "R2", hole: 1, net: 0 },
      { playerId: "A", roundId: "R2", hole: 2, net: 2 },
    ];
    // 4 + (-1) + 0 + 2 = 5
    const result = computeIndividualRace(entries);
    expect(result.standings).toEqual([
      { playerId: "A", cumulativeNet: 5, holesPlayed: 4 },
    ]);
  });

  it("identifies daily low net per round and shares ties across players", () => {
    const entries: PlayerHoleNet[] = [
      { playerId: "A", roundId: "R1", hole: 1, net: -2 },
      { playerId: "B", roundId: "R1", hole: 1, net: -2 },
      { playerId: "C", roundId: "R1", hole: 1, net: 1 },
    ];
    const result = computeIndividualRace(entries);
    expect(result.dailyLows).toEqual([
      { roundId: "R1", net: -2, playerIds: ["A", "B"] },
    ]);
  });

  it("produces valid running totals mid-round without corrupting on missing holes", () => {
    // Only 3 of 18 holes entered so far — a missing hole simply isn't in the array.
    const entries: PlayerHoleNet[] = [
      { playerId: "A", roundId: "R1", hole: 1, net: 3 },
      { playerId: "A", roundId: "R1", hole: 2, net: -1 },
      { playerId: "A", roundId: "R1", hole: 5, net: 0 },
    ];
    expect(() => computeIndividualRace(entries)).not.toThrow();
    const result = computeIndividualRace(entries);
    expect(result.standings).toEqual([
      { playerId: "A", cumulativeNet: 2, holesPlayed: 3 },
    ]);
  });

  it("uses the real score, not the match score, when they diverge (RM-proof)", () => {
    const row = { strokes: 3, matchStrokes: 5 };
    // The correct construction reads realScore for the individual race...
    const correctEntry: PlayerHoleNet = {
      playerId: "X",
      roundId: "R1",
      hole: 1,
      net: netScore(realScore(row), 0),
    };
    expect(computeIndividualRace([correctEntry]).standings[0].cumulativeNet).toBe(3);

    // ...and would be wrong (5) if a caller mistakenly used matchScore instead.
    const wrongEntry: PlayerHoleNet = {
      playerId: "X",
      roundId: "R1",
      hole: 1,
      net: netScore(matchScore(row), 0),
    };
    expect(computeIndividualRace([wrongEntry]).standings[0].cumulativeNet).toBe(5);
  });
});
