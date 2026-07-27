import { describe, expect, it } from "vitest";
import { realScore } from "./netScore";
import { computeSkins, type SkinsHoleScore } from "./skins";

describe("computeSkins", () => {
  it("unique low among entrants wins the hole", () => {
    const scores: SkinsHoleScore[] = [
      { playerId: "A", hole: 1, strokes: 4 },
      { playerId: "B", hole: 1, strokes: 5 },
      { playerId: "C", hole: 1, strokes: 5 },
    ];
    const result = computeSkins(scores, ["A", "B", "C"]);

    expect(result.holes[0]).toEqual({ hole: 1, status: "won", winner: "A" });
    expect(result.skinsWonByPlayer).toEqual({ A: 1 });
  });

  it("non-entrants are invisible: their score neither wins nor blocks", () => {
    const scores: SkinsHoleScore[] = [
      { playerId: "A", hole: 1, strokes: 5 },
      { playerId: "B", hole: 1, strokes: 4 },
      { playerId: "NON_ENTRANT", hole: 1, strokes: 1 },
    ];
    const result = computeSkins(scores, ["A", "B"]);

    expect(result.holes[0]).toEqual({ hole: 1, status: "won", winner: "B" });
    expect(result.skinsWonByPlayer).toEqual({ B: 1 });
  });

  it("carries a chain of ties until a unique low resolves it", () => {
    const scores: SkinsHoleScore[] = [
      { playerId: "A", hole: 1, strokes: 4 },
      { playerId: "B", hole: 1, strokes: 4 },
      { playerId: "A", hole: 2, strokes: 5 },
      { playerId: "B", hole: 2, strokes: 5 },
      { playerId: "A", hole: 3, strokes: 3 },
      { playerId: "B", hole: 3, strokes: 6 },
    ];
    const result = computeSkins(scores, ["A", "B"]);

    expect(result.holes[0].status).toBe("carried");
    expect(result.holes[1].status).toBe("carried");
    expect(result.holes[2]).toEqual({ hole: 3, status: "won", winner: "A" });
    expect(result.wins).toEqual([
      { resolvingHole: 3, coveredHoles: [1, 2, 3], carriedIn: 0, winner: "A" },
    ]);
    expect(result.skinsWonByPlayer).toEqual({ A: 3 });
  });

  it("voids a chain that ties all the way through 18 — no crash", () => {
    const scores: SkinsHoleScore[] = [
      { playerId: "A", hole: 16, strokes: 4 },
      { playerId: "B", hole: 16, strokes: 4 },
      { playerId: "A", hole: 17, strokes: 4 },
      { playerId: "B", hole: 17, strokes: 4 },
      { playerId: "A", hole: 18, strokes: 4 },
      { playerId: "B", hole: 18, strokes: 4 },
    ];

    expect(() => computeSkins(scores, ["A", "B"])).not.toThrow();

    const result = computeSkins(scores, ["A", "B"]);
    expect(result.voidHoles).toEqual([16, 17, 18]);
    expect(result.holes.filter((h) => h.hole >= 16).every((h) => h.status === "void")).toBe(true);
    expect(result.wins).toEqual([]);
    expect(result.skinsWonByPlayer).toEqual({});
  });

  it("computes over a small entrant pool (3 of the field)", () => {
    const scores: SkinsHoleScore[] = [
      { playerId: "A", hole: 1, strokes: 4 },
      { playerId: "B", hole: 1, strokes: 3 },
      { playerId: "C", hole: 1, strokes: 5 },
      { playerId: "D", hole: 1, strokes: 1 }, // not an entrant
    ];
    const result = computeSkins(scores, ["A", "B", "C"]);

    expect(result.holes[0].winner).toBe("B");
  });

  it("an entrant whose holed shot was reverse-mulliganed still wins on his real score", () => {
    // Real score 3 (holed), match score diverged to 5 by the RM — skins must read realScore.
    const rmRow = { strokes: 3, matchStrokes: 5 };
    const scores: SkinsHoleScore[] = [
      { playerId: "X", hole: 1, strokes: realScore(rmRow) },
      { playerId: "Y", hole: 1, strokes: 4 },
    ];
    const result = computeSkins(scores, ["X", "Y"]);

    expect(result.holes[0]).toEqual({ hole: 1, status: "won", winner: "X" });
  });
});

describe("computeSkins — cross-round carryIn (Addendum A §2, revised Jul 26 2026)", () => {
  it("a Saturday tail that never resolved rides into Sunday and is claimed by Sunday's first winner", () => {
    // Saturday: holes 17-18 tie all the way through, 2 unclaimed skins.
    const saturdayScores: SkinsHoleScore[] = [
      { playerId: "A", hole: 17, strokes: 4 },
      { playerId: "B", hole: 17, strokes: 4 },
      { playerId: "A", hole: 18, strokes: 4 },
      { playerId: "B", hole: 18, strokes: 4 },
    ];
    const saturday = computeSkins(saturdayScores, ["A", "B"]);
    expect(saturday.voidHoles).toEqual([17, 18]);

    // Sunday: hole 1 resolves immediately with a unique low score.
    const sundayScores: SkinsHoleScore[] = [
      { playerId: "A", hole: 1, strokes: 3 },
      { playerId: "B", hole: 1, strokes: 5 },
    ];
    const sunday = computeSkins(sundayScores, ["A", "B"], saturday.voidHoles.length);

    expect(sunday.wins).toEqual([
      { resolvingHole: 1, coveredHoles: [1], carriedIn: 2, winner: "A" },
    ]);
    // Hole 1's own value plus the 2 carried-in skins from Saturday, combined.
    expect(sunday.skinsWonByPlayer).toEqual({ A: 3 });
    expect(sunday.unresolvedCarryIn).toBe(0);
  });

  it("a Saturday round that resolves cleanly leaves Sunday unaffected, matching current behavior exactly", () => {
    const saturdayScores: SkinsHoleScore[] = [
      { playerId: "A", hole: 1, strokes: 3 },
      { playerId: "B", hole: 1, strokes: 5 },
    ];
    const saturday = computeSkins(saturdayScores, ["A", "B"]);
    expect(saturday.voidHoles).toEqual([]);

    const sundayScores: SkinsHoleScore[] = [
      { playerId: "A", hole: 1, strokes: 4 },
      { playerId: "B", hole: 1, strokes: 3 },
    ];
    const sundayWithCarry = computeSkins(sundayScores, ["A", "B"], saturday.voidHoles.length);
    const sundayNoCarry = computeSkins(sundayScores, ["A", "B"]);

    expect(sundayWithCarry).toEqual(sundayNoCarry);
    expect(sundayWithCarry.wins).toEqual([
      { resolvingHole: 1, coveredHoles: [1], carriedIn: 0, winner: "B" },
    ]);
  });

  it("carry-in that's still unclaimed when the round itself voids is surfaced, not silently dropped", () => {
    const scores: SkinsHoleScore[] = [
      { playerId: "A", hole: 18, strokes: 4 },
      { playerId: "B", hole: 18, strokes: 4 },
    ];
    // Only hole 18 has scores — every earlier hole is "unplayed", not "carried", so the tie
    // on 18 alone voids with nowhere to send the incoming carry either.
    const result = computeSkins(scores, ["A", "B"], 3);

    expect(result.wins).toEqual([]);
    expect(result.voidHoles).toEqual([18]);
    expect(result.unresolvedCarryIn).toBe(3);
  });
});
