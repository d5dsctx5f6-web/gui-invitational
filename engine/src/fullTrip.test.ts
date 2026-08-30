import { describe, expect, it } from "vitest";
import { computeMatchState } from "./matchState";
import {
  ALL_HOLE_SCORES,
  ALL_PLAYERS,
  COMPUTED_MATCHES,
  DRIVES_USED_TALLY,
  PAR,
  SATURDAY_RANKING,
  computedMatch,
  rmStatusFor,
} from "./fixtures/fullTrip";

// Brief 31's gate: one hand-constructed simulated round — North Hedges vs South Hedges, 8v8,
// four duo-vs-duo scramble matches — with every v2.0 rule firing together. Fixture and every
// derived number live in ./fixtures/fullTrip.ts. See that file's header comment for the plot
// points (a clean sweep, the mirror case, a mercy cap, a reverse mulligan).

describe("match state across all 4 matches", () => {
  it("Match 1 (N1 v S1): North sweeps holes 1-3, rest halved -> North wins 2.5-0.5", () => {
    const m = computedMatch(1);
    // Front 9 closes early at thru=7: a 3up lead becomes mathematically insurmountable once
    // only 2 holes remain (remaining < holesUp).
    expect(m.state).toMatchObject({
      front9: { winner: "A", holesUp: 3, thru: 7 },
      back9: { winner: "halved", holesUp: 0, thru: 9 },
      overall18: { winner: "A", holesUp: 3, thru: 16 },
      totalPoints: { a: 2.5, b: 0.5 },
    });
    expect(m.holesWon).toEqual({ a: 3, b: 0 });
  });

  it("Match 2 (N2 v S2): South sweeps holes 10-12, the mirror case -> South wins 2.5-0.5", () => {
    const m = computedMatch(2);
    expect(m.state).toMatchObject({
      front9: { winner: "halved", holesUp: 0, thru: 9 },
      back9: { winner: "B", holesUp: -3, thru: 7 },
      overall18: { winner: "B", holesUp: -3, thru: 16 },
      totalPoints: { a: 0.5, b: 2.5 },
    });
    expect(m.holesWon).toEqual({ a: 0, b: 3 });
  });

  it("every segment is decided — closed, not left in progress", () => {
    for (const slot of [1, 2, 3, 4] as const) {
      const state = computedMatch(slot).state;
      expect(state.front9.status).toBe("closed");
      expect(state.back9.status).toBe("closed");
      expect(state.overall18.status).toBe("closed");
    }
  });
});

describe("mercy cap: Match 3 (N3 v S3)", () => {
  it("North's raw 9 on hole 5 is capped to 6, halving the hole instead of losing it outright", () => {
    // Raw: N3 shot 9, S3 shot 6 on hole 5 (par 4). Uncapped, 9 loses to 6 outright. Capped at
    // par+2=6, both duos are at 6 -> the hole halves instead.
    const n3Hole5 = ALL_HOLE_SCORES.find((r) => r.duoId === "N3" && r.hole === 5)!;
    const s3Hole5 = ALL_HOLE_SCORES.find((r) => r.duoId === "S3" && r.hole === 5)!;
    expect(n3Hole5.strokes).toBe(PAR + 5); // raw, uncapped, untouched in storage
    expect(s3Hole5.strokes).toBe(PAR + 2);

    const m = computedMatch(3);
    expect(m.state.totalPoints).toEqual({ a: 1.5, b: 1.5 }); // fully halved, cap saved the hole
    expect(m.holesWon).toEqual({ a: 0, b: 0 });
  });
});

describe("reverse mulligan: Match 4 (N4 v S4)", () => {
  it("North's RM call resolves to a single posted score — South's replay result on hole 8", () => {
    const s4Hole8 = ALL_HOLE_SCORES.find((r) => r.duoId === "S4" && r.hole === 8)!;
    // No original/match-score divergence to capture -- this IS the score, full stop.
    expect(s4Hole8.strokes).toBe(PAR + 1);

    expect(rmStatusFor("N4")).toEqual({ available: false, usedOnHole: 8 });
    expect(rmStatusFor("S4")).toEqual({ available: true, usedOnHole: null }); // the victim, not the caller
  });

  it("the RM'd hole feeds match state directly, the same as any other hole", () => {
    const m = computedMatch(4);
    expect(m.state).toMatchObject({
      front9: { winner: "A", holesUp: 1, thru: 9 },
      back9: { winner: "halved", holesUp: 0, thru: 9 },
      overall18: { winner: "A", holesUp: 1, thru: 18 },
      totalPoints: { a: 2.5, b: 0.5 },
    });
  });
});

describe("North/South standings tally", () => {
  it("North leads 7-5 on points across all four matches, no tie", () => {
    expect(SATURDAY_RANKING.totals).toEqual(
      expect.arrayContaining([
        { teamId: "North", points: 7, holesWon: 4 },
        { teamId: "South", points: 5, holesWon: 3 },
      ]),
    );
    expect(SATURDAY_RANKING.buckets).toEqual([
      { rank: 1, teamIds: ["North"], chipOffRequired: false },
      { rank: 2, teamIds: ["South"], chipOffRequired: false },
    ]);
  });

  it("the round's total points sum to 12, matching 4 matches x 3 points", () => {
    const total = COMPUTED_MATCHES.reduce(
      (sum, m) => sum + m.state.totalPoints.a + m.state.totalPoints.b,
      0,
    );
    expect(total).toBe(12);
  });
});

describe("Drives Used", () => {
  it("every player's tee shots tally correctly from the raw per-hole taps", () => {
    // Each duo alternates its two players evenly across 18 holes -> 9 drives each.
    for (const name of ALL_PLAYERS) {
      expect(DRIVES_USED_TALLY[name]).toBe(9);
    }
    const total = Object.values(DRIVES_USED_TALLY).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(16 * 9);
  });
});

describe("count-agnostic: a duo missing a hole score doesn't crash match-state computation", () => {
  it("a hole with no score posted for either duo yet is skipped, not corrupted into a loss", () => {
    const holes = [
      { hole: 1, par: PAR, duoAStrokes: null, duoBStrokes: null },
      { hole: 2, par: PAR, duoAStrokes: 3, duoBStrokes: 4 },
    ];
    expect(() => computeMatchState(holes)).not.toThrow();
    expect(computeMatchState(holes).front9).toMatchObject({ thru: 1, status: "in_progress" });
  });
});
