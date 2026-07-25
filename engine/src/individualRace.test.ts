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
      { playerId: "A", cumulativeNet: 5, cumulativeGross: 0, parPlayed: 0, holesPlayed: 4 },
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
      { playerId: "A", cumulativeNet: 2, cumulativeGross: 0, parPlayed: 0, holesPlayed: 3 },
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

  it("accumulates gross and par-played alongside net, for callers that supply them (Brief 16)", () => {
    // Cam Delaney hand-check from the Brief 16 bug report: par 4/4/5, strokes 5/5/6, 0 dots.
    const entries: PlayerHoleNet[] = [
      { playerId: "Cam", roundId: "R1", hole: 1, net: 5, gross: 5, par: 4 },
      { playerId: "Cam", roundId: "R1", hole: 2, net: 5, gross: 5, par: 4 },
      { playerId: "Cam", roundId: "R1", hole: 3, net: 6, gross: 6, par: 5 },
    ];
    const result = computeIndividualRace(entries);
    expect(result.standings).toEqual([
      { playerId: "Cam", cumulativeNet: 16, cumulativeGross: 16, parPlayed: 13, holesPlayed: 3 },
    ]);
    // Net-to-par: 16 - 13 = +3, not the raw +16 the bug report flagged.
    expect(result.standings[0].cumulativeNet - result.standings[0].parPlayed).toBe(3);
  });

  it("defaults gross/par to 0 when entries omit them (existing scorecard-only callers)", () => {
    const entries: PlayerHoleNet[] = [
      { playerId: "A", roundId: "R1", hole: 1, net: 4 },
    ];
    const result = computeIndividualRace(entries);
    expect(result.standings[0].cumulativeGross).toBe(0);
    expect(result.standings[0].parPlayed).toBe(0);
  });
});
