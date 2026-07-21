import { describe, expect, it } from "vitest";
import { rankTeams, type TeamMatchOutcome } from "./standings";

describe("rankTeams", () => {
  it("orders teams cleanly by points when nothing is tied", () => {
    const outcomes: TeamMatchOutcome[] = [
      { teamAId: "T1", teamBId: "T2", points: { a: 2, b: 1 }, holesWon: { a: 6, b: 3 } },
      { teamAId: "T3", teamBId: "T4", points: { a: 2, b: 1 }, holesWon: { a: 6, b: 3 } },
      { teamAId: "T1", teamBId: "T3", points: { a: 2, b: 1 }, holesWon: { a: 6, b: 3 } },
      { teamAId: "T2", teamBId: "T4", points: { a: 2, b: 1 }, holesWon: { a: 7, b: 2 } },
    ];
    // T1 = 4, T2 = 3, T3 = 3, T4 = 2. T2/T3 never played each other -> falls to holes won:
    // T2 = 3 + 7 = 10, T3 = 6 + 3 = 9 -> T2 ahead.
    const ranking = rankTeams(["T1", "T2", "T3", "T4"], outcomes);

    expect(ranking.buckets).toEqual([
      { rank: 1, teamIds: ["T1"], chipOffRequired: false },
      { rank: 2, teamIds: ["T2"], chipOffRequired: false },
      { rank: 3, teamIds: ["T3"], chipOffRequired: false },
      { rank: 4, teamIds: ["T4"], chipOffRequired: false },
    ]);
  });

  it("breaks a points tie with head-to-head when the tied teams played each other", () => {
    const outcomes: TeamMatchOutcome[] = [
      { teamAId: "X", teamBId: "Y", points: { a: 2, b: 1 }, holesWon: { a: 5, b: 4 } },
      { teamAId: "X", teamBId: "Z", points: { a: 0, b: 2 }, holesWon: { a: 3, b: 6 } },
      { teamAId: "Y", teamBId: "Z", points: { a: 1, b: 1 }, holesWon: { a: 4, b: 4 } },
    ];
    // X = 2, Y = 1 + 1 = 2 (tied). Z = 2 + 1 = 3 (clear leader).
    // Head-to-head X vs Y (match 1 only): X got 2, Y got 1 -> X ahead of Y.
    const ranking = rankTeams(["X", "Y", "Z"], outcomes);

    expect(ranking.buckets).toEqual([
      { rank: 1, teamIds: ["Z"], chipOffRequired: false },
      { rank: 2, teamIds: ["X"], chipOffRequired: false },
      { rank: 3, teamIds: ["Y"], chipOffRequired: false },
    ]);
  });

  it("skips head-to-head when the tied teams never played, falling to holes won", () => {
    const outcomes: TeamMatchOutcome[] = [
      { teamAId: "T1", teamBId: "T2", points: { a: 2, b: 1 }, holesWon: { a: 6, b: 3 } },
      { teamAId: "T3", teamBId: "T4", points: { a: 2, b: 1 }, holesWon: { a: 6, b: 3 } },
      { teamAId: "T1", teamBId: "T3", points: { a: 2, b: 1 }, holesWon: { a: 6, b: 3 } },
      { teamAId: "T2", teamBId: "T4", points: { a: 2, b: 1 }, holesWon: { a: 7, b: 2 } },
    ];
    const ranking = rankTeams(["T1", "T2", "T3", "T4"], outcomes);
    const secondPlace = ranking.buckets.find((b) => b.rank === 2)!;
    expect(secondPlace.teamIds).toEqual(["T2"]);
    expect(secondPlace.chipOffRequired).toBe(false);
  });

  it("surfaces chipOffRequired when a tie survives every automatic criterion", () => {
    const outcomes: TeamMatchOutcome[] = [
      { teamAId: "A", teamBId: "B", points: { a: 3, b: 1 }, holesWon: { a: 5, b: 3 } },
      { teamAId: "A", teamBId: "C", points: { a: 2, b: 1 }, holesWon: { a: 5, b: 3 } },
      { teamAId: "B", teamBId: "D", points: { a: 2, b: 0 }, holesWon: { a: 5, b: 0 } },
      { teamAId: "C", teamBId: "D", points: { a: 2, b: 0 }, holesWon: { a: 5, b: 0 } },
    ];
    // A = 5 (clear 1st), D = 0 (clear last). B = 1 + 2 = 3, C = 1 + 2 = 3 (tied).
    // B and C never played each other, and their holes-won totals are also equal (8 each).
    const ranking = rankTeams(["A", "B", "C", "D"], outcomes);

    expect(ranking.buckets).toEqual([
      { rank: 1, teamIds: ["A"], chipOffRequired: false },
      { rank: 2, teamIds: expect.arrayContaining(["B", "C"]), chipOffRequired: true },
      { rank: 4, teamIds: ["D"], chipOffRequired: false },
    ]);
    expect(ranking.buckets[1].teamIds).toHaveLength(2);
  });

  it("reports totals for every team, for the UI's 'why this order' breakdown", () => {
    const outcomes: TeamMatchOutcome[] = [
      { teamAId: "T1", teamBId: "T2", points: { a: 3, b: 0 }, holesWon: { a: 8, b: 1 } },
    ];
    const ranking = rankTeams(["T1", "T2"], outcomes);
    expect(ranking.totals).toEqual(
      expect.arrayContaining([
        { teamId: "T1", points: 3, holesWon: 8 },
        { teamId: "T2", points: 0, holesWon: 1 },
      ]),
    );
  });
});
