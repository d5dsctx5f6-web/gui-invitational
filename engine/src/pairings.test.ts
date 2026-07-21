import { describe, expect, it } from "vitest";
import { computeEarnedPairings } from "./pairings";
import { rankTeams, type TeamMatchOutcome } from "./standings";

describe("computeEarnedPairings", () => {
  it("pairs 1v2 and 3v4 from a clean Saturday ranking", () => {
    const outcomes: TeamMatchOutcome[] = [
      { teamAId: "T1", teamBId: "T2", points: { a: 2, b: 1 }, holesWon: { a: 6, b: 3 } },
      { teamAId: "T3", teamBId: "T4", points: { a: 2, b: 1 }, holesWon: { a: 6, b: 3 } },
      { teamAId: "T1", teamBId: "T3", points: { a: 2, b: 1 }, holesWon: { a: 6, b: 3 } },
      { teamAId: "T2", teamBId: "T4", points: { a: 2, b: 1 }, holesWon: { a: 7, b: 2 } },
    ];
    const ranking = rankTeams(["T1", "T2", "T3", "T4"], outcomes);
    const result = computeEarnedPairings(ranking);

    expect(result).toEqual({
      status: "determined",
      matchups: [
        { seedA: 1, seedB: 2, teamAId: "T1", teamBId: "T2" },
        { seedA: 3, seedB: 4, teamAId: "T3", teamBId: "T4" },
      ],
    });
  });

  it("surfaces chipOffRequired when the 2/3 seed boundary is tied", () => {
    const outcomes: TeamMatchOutcome[] = [
      { teamAId: "A", teamBId: "B", points: { a: 3, b: 1 }, holesWon: { a: 5, b: 3 } },
      { teamAId: "A", teamBId: "C", points: { a: 2, b: 1 }, holesWon: { a: 5, b: 3 } },
      { teamAId: "B", teamBId: "D", points: { a: 2, b: 0 }, holesWon: { a: 5, b: 0 } },
      { teamAId: "C", teamBId: "D", points: { a: 2, b: 0 }, holesWon: { a: 5, b: 0 } },
    ];
    const ranking = rankTeams(["A", "B", "C", "D"], outcomes);
    const result = computeEarnedPairings(ranking);

    expect(result.status).toBe("chipOffRequired");
    if (result.status === "chipOffRequired") {
      expect(result.tiedTeamIds).toEqual(expect.arrayContaining(["B", "C"]));
      expect(result.affectedSeeds).toEqual([2, 3]);
    }
  });

  it("surfaces chipOffRequired when the 1/2 seed boundary itself is tied", () => {
    // Two teams dead even, nothing to separate them.
    const ranking = rankTeams(["P", "Q"], []);
    const result = computeEarnedPairings(ranking);

    expect(result.status).toBe("chipOffRequired");
    if (result.status === "chipOffRequired") {
      expect(result.tiedTeamIds).toEqual(expect.arrayContaining(["P", "Q"]));
      expect(result.affectedSeeds).toEqual([1, 2]);
    }
  });
});
