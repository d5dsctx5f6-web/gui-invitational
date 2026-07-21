import { describe, expect, it } from "vitest";
import { strokesForHoles } from "./handicap";
import { matchScore, netScore } from "./netScore";

describe("netScore", () => {
  it("subtracts the strokes received on that hole, and only that hole", () => {
    const strokeIndexByHole = Array.from({ length: 18 }, (_, i) => i + 1);
    const strokes = strokesForHoles(10, strokeIndexByHole); // holes 1-10 get a dot

    // Hole 3 (a dot): gross 5 -> net 4.
    expect(netScore(5, strokes[2])).toBe(4);
    // Hole 15 (no dot): gross 4 -> net 4, unchanged.
    expect(netScore(4, strokes[14])).toBe(4);
  });
});

describe("matchScore", () => {
  it("reads the real stroke count when no reverse mulligan diverged it", () => {
    expect(matchScore({ strokes: 5 })).toBe(5);
    expect(matchScore({ strokes: 5, matchStrokes: null })).toBe(5);
  });

  it("reads the match-only score when a reverse mulligan diverged it", () => {
    expect(matchScore({ strokes: 3, matchStrokes: 5 })).toBe(5);
  });
});
