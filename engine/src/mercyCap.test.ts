import { describe, expect, it } from "vitest";
import { cappedStrokes } from "./mercyCap";

describe("cappedStrokes", () => {
  it("passes through a score at or below par + 2 unchanged", () => {
    expect(cappedStrokes(6, 4)).toBe(6); // exactly the cap
    expect(cappedStrokes(4, 4)).toBe(4); // par
    expect(cappedStrokes(2, 4)).toBe(2); // eagle
  });

  it("caps a score above par + 2 down to par + 2", () => {
    expect(cappedStrokes(9, 4)).toBe(6);
    expect(cappedStrokes(12, 5)).toBe(7);
  });

  it("scales with par (a par 5 caps at 7, a par 3 caps at 5)", () => {
    expect(cappedStrokes(9, 5)).toBe(7);
    expect(cappedStrokes(9, 3)).toBe(5);
  });
});
