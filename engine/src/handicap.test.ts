import { describe, expect, it } from "vitest";
import { courseHandicap, dotsForPlayer, playingHandicap, strokesForHoles } from "./handicap";

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

describe("dotsForPlayer (Brief 18 — null index must never produce real strokes)", () => {
  // GreyHawk's actual tee: rating 71.4, par 72 -> rating - par = -0.6, rounds to -1. This is
  // exactly the shape that turned "index coerced to 0" into a real (if small) computed
  // handicap for players whose index is simply unknown, not a confirmed scratch golfer.
  const greyHawkTee = { rating: 71.4, slope: 137, par: 72 };
  const strokeIndexByHole = [
    9, 13, 5, 7, 17, 1, 11, 15, 3, 4, 16, 2, 14, 10, 8, 12, 18, 6,
  ];

  it("gives a null index zero strokes on every hole, formula never runs", () => {
    const dots = dotsForPlayer(null, greyHawkTee, strokeIndexByHole);
    expect(dots).toEqual(Array(18).fill(0));
  });

  it("a real 0.0 index still runs the real formula (can legitimately go negative)", () => {
    // round(0 * 137/113 + (71.4-72)) = round(-0.6) = -1 -> base -1, remainder 17 -> every hole
    // gets 0 except the single SI-18 hole, which gets -1 (a stroke given back).
    const dots = dotsForPlayer(0, greyHawkTee, strokeIndexByHole);
    const si18HoleIndex = strokeIndexByHole.indexOf(18);
    expect(dots[si18HoleIndex]).toBe(-1);
    expect(dots.filter((_, i) => i !== si18HoleIndex).every((d) => d === 0)).toBe(true);
  });

  it("a real positive index is unaffected by the null fix", () => {
    // Chris Deliso's real trip index: 9.9 -> course handicap 11 (confirmed in prior briefs).
    const dots = dotsForPlayer(9.9, greyHawkTee, strokeIndexByHole);
    expect(dots.reduce((sum, d) => sum + d, 0)).toBe(11);
  });

  it("net never exceeds gross for a null-index player (the actual reported bug)", () => {
    // Ben Meier's shape: null index, 18 real holes posted.
    const dots = dotsForPlayer(null, greyHawkTee, strokeIndexByHole);
    const grossPerHole = [4, 5, 4, 4, 6, 3, 5, 5, 3, 5, 4, 3, 6, 4, 5, 6, 6, 6];
    const gross = grossPerHole.reduce((sum, s) => sum + s, 0);
    const net = grossPerHole.reduce((sum, s, i) => sum + (s - dots[i]), 0);
    expect(net).toBe(gross); // pre-fix, a null index would have made this 1 higher, never equal
  });
});
