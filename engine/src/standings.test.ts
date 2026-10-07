import { describe, expect, it } from "vitest";
import { rankTeams, type TeamMatchOutcome } from "./standings";

describe("rankTeams", () => {
  it("points beat holes won: the points leader ranks first even with far fewer holes", () => {
    const outcomes: TeamMatchOutcome[] = [
      { teamAId: "North", teamBId: "South", points: { a: 2, b: 1 }, holesWon: { a: 4, b: 14 } },
      { teamAId: "North", teamBId: "South", points: { a: 2, b: 1 }, holesWon: { a: 5, b: 12 } },
    ];
    const ranking = rankTeams(["North", "South"], outcomes);
    expect(ranking.buckets[0]).toEqual({ rank: 1, teamIds: ["North"], chipOffRequired: false });
    expect(ranking.totals).toEqual(
      expect.arrayContaining([
        { teamId: "North", points: 4, holesWon: 9 },
        { teamId: "South", points: 2, holesWon: 26 },
      ]),
    );
  });

  it("orders North and South cleanly by points when nothing is tied", () => {
    const outcomes: TeamMatchOutcome[] = [
      { teamAId: "North", teamBId: "South", points: { a: 3, b: 0 }, holesWon: { a: 8, b: 1 } },
      { teamAId: "North", teamBId: "South", points: { a: 2, b: 1 }, holesWon: { a: 6, b: 3 } },
    ];
    const ranking = rankTeams(["North", "South"], outcomes);

    expect(ranking.buckets).toEqual([
      { rank: 1, teamIds: ["North"], chipOffRequired: false },
      { rank: 2, teamIds: ["South"], chipOffRequired: false },
    ]);
    expect(ranking.totals).toEqual(
      expect.arrayContaining([
        { teamId: "North", points: 5, holesWon: 14 },
        { teamId: "South", points: 1, holesWon: 4 },
      ]),
    );
  });

  it("breaks a points tie with total holes won", () => {
    const outcomes: TeamMatchOutcome[] = [
      { teamAId: "North", teamBId: "South", points: { a: 1.5, b: 1.5 }, holesWon: { a: 5, b: 4 } },
      { teamAId: "North", teamBId: "South", points: { a: 1.5, b: 1.5 }, holesWon: { a: 4, b: 5 } },
      { teamAId: "North", teamBId: "South", points: { a: 1.5, b: 1.5 }, holesWon: { a: 6, b: 3 } },
      { teamAId: "North", teamBId: "South", points: { a: 1.5, b: 1.5 }, holesWon: { a: 3, b: 4 } },
    ];
    // Points: North 6, South 6 -- tied. Holes: North 18, South 16 -- North ahead.
    const ranking = rankTeams(["North", "South"], outcomes);

    expect(ranking.buckets).toEqual([
      { rank: 1, teamIds: ["North"], chipOffRequired: false },
      { rank: 2, teamIds: ["South"], chipOffRequired: false },
    ]);
  });

  it("surfaces chipOffRequired on a genuine 12-12 tie: points AND holes won both dead level", () => {
    const outcomes: TeamMatchOutcome[] = [
      { teamAId: "North", teamBId: "South", points: { a: 3, b: 0 }, holesWon: { a: 8, b: 1 } },
      { teamAId: "North", teamBId: "South", points: { a: 0, b: 3 }, holesWon: { a: 1, b: 8 } },
      { teamAId: "North", teamBId: "South", points: { a: 1.5, b: 1.5 }, holesWon: { a: 5, b: 5 } },
      { teamAId: "North", teamBId: "South", points: { a: 1.5, b: 1.5 }, holesWon: { a: 5, b: 5 } },
    ];
    // Points: North 6, South 6 across this round -- with a matching second round elsewhere in
    // the trip this is exactly how a 24-total-point trip ends 12-12. Holes: North 19, South 19.
    const ranking = rankTeams(["North", "South"], outcomes);

    expect(ranking.buckets).toEqual([
      { rank: 1, teamIds: expect.arrayContaining(["North", "South"]), chipOffRequired: true },
    ]);
    expect(ranking.buckets[0].teamIds).toHaveLength(2);
    expect(ranking.totals).toEqual(
      expect.arrayContaining([
        { teamId: "North", points: 6, holesWon: 19 },
        { teamId: "South", points: 6, holesWon: 19 },
      ]),
    );
  });

  it("reports totals for both teams, for the UI's 'why this order' breakdown", () => {
    const outcomes: TeamMatchOutcome[] = [
      { teamAId: "North", teamBId: "South", points: { a: 3, b: 0 }, holesWon: { a: 8, b: 1 } },
    ];
    const ranking = rankTeams(["North", "South"], outcomes);
    expect(ranking.totals).toEqual(
      expect.arrayContaining([
        { teamId: "North", points: 3, holesWon: 8 },
        { teamId: "South", points: 0, holesWon: 1 },
      ]),
    );
  });
});
