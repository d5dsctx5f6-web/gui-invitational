import { describe, expect, it } from "vitest";
import { courseHandicap, playingHandicap, strokesForHoles } from "./handicap";

describe("courseHandicap", () => {
  it("matches a neutral course (slope 113, rating == par)", () => {
    // 10 * (113/113) + (72-72) = 10
    expect(courseHandicap(10, { slope: 113, rating: 72, par: 72 })).toBe(10);
  });

  it("rounds a fractional result", () => {
    // 8.5 * (133/113) + (70.1-70) = 10.00442... + 0.1 = 10.10442 -> 10
    expect(courseHandicap(8.5, { slope: 133, rating: 70.1, par: 70 })).toBe(10);
  });

  it("handles a rating below par (negative differential)", () => {
    // 6 * (118/113) + (69-72) = 6.2655... - 3 = 3.2655 -> 3
    expect(courseHandicap(6, { slope: 118, rating: 69, par: 72 })).toBe(3);
  });

  it("can exceed 18", () => {
    // 20 * (124/113) + (71-71) = 21.9469... -> 22
    expect(courseHandicap(20, { slope: 124, rating: 71, par: 71 })).toBe(22);
  });
});

describe("playingHandicap", () => {
  it("is the identity at 100% allowance (the Brief 3 hook defaults to full handicap)", () => {
    expect(playingHandicap(14)).toBe(14);
  });

  it("applies an allowance percentage when supplied", () => {
    expect(playingHandicap(14, 0.8)).toBe(11); // round(14 * 0.8) = round(11.2) = 11
  });
});

describe("strokesForHoles", () => {
  it("gives one stroke to the lowest-SI holes up to the handicap", () => {
    const strokeIndexByHole = Array.from({ length: 18 }, (_, i) => i + 1); // hole n has SI n
    const strokes = strokesForHoles(10, strokeIndexByHole);

    expect(strokes.slice(0, 10)).toEqual(Array(10).fill(1));
    expect(strokes.slice(10)).toEqual(Array(8).fill(0));
  });

  it("wraps for a handicap over 18: every hole gets a base stroke, remainder on lowest SI", () => {
    // Hole n -> SI value, zigzag pattern with each of 1-18 used exactly once.
    const strokeIndexByHole = [
      7, 13, 1, 15, 5, 11, 17, 3, 9, 8, 14, 2, 16, 6, 12, 18, 4, 10,
    ];
    const strokes = strokesForHoles(22, strokeIndexByHole); // base 1, remainder 4

    const expected = strokeIndexByHole.map((si) => (si <= 4 ? 2 : 1));
    expect(strokes).toEqual(expected);
    expect(strokes.reduce((sum, s) => sum + s, 0)).toBe(22);
  });
});
