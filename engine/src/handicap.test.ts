import { describe, expect, it } from "vitest";
import { courseHandicap } from "./handicap";

// Brief 31: courseHandicap() is the only function left in this module — display-only captain
// intel now (PRODUCT_SPEC_V2 §2), never a scoring input. playingHandicap()/strokesForHoles()/
// dotsForPlayer() are deleted, along with their tests: v2.0 gives no strokes anywhere, so
// there's nothing left to allocate across holes. Same formula, same math, different docstring.

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

  it("a real 0.0 index still runs the formula (can legitimately go negative)", () => {
    // GreyHawk's actual tee: rating 71.4, par 72 -> round(0 * 137/113 + (71.4-72)) = round(-0.6) = -1.
    expect(courseHandicap(0, { rating: 71.4, slope: 137, par: 72 })).toBe(-1);
  });
});
