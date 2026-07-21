import { describe, expect, it } from "vitest";
import { DEFAULT_ALLOWANCE, resolveAllowance, type AllowanceConfig } from "./config";
import { playingHandicap, strokesForHoles } from "./handicap";

describe("resolveAllowance", () => {
  it("defaults to 100% (Addendum A)", () => {
    expect(resolveAllowance(DEFAULT_ALLOWANCE)).toBe(1);
    expect(resolveAllowance(DEFAULT_ALLOWANCE, "shamble")).toBe(1);
  });

  it("allows a per-format override without touching the default", () => {
    const config: AllowanceConfig = { default: 1, byFormat: { shamble: 0.9 } };
    expect(resolveAllowance(config, "shamble")).toBe(0.9);
    expect(resolveAllowance(config, "four_ball")).toBe(1);
    expect(resolveAllowance(config)).toBe(1);
  });
});

describe("allowance applied through the handicap pipeline", () => {
  const strokeIndexByHole = Array.from({ length: 18 }, (_, i) => i + 1);

  it("is a no-op at 100% (existing Brief 2 behavior)", () => {
    const dots = strokesForHoles(playingHandicap(10, resolveAllowance(DEFAULT_ALLOWANCE)), strokeIndexByHole);
    expect(dots.filter((d) => d > 0)).toHaveLength(10);
  });

  it("reduces strokes correctly at 90%: handicap 10 -> playing handicap 9", () => {
    const config: AllowanceConfig = { default: 0.9 };
    const handicap = 10;
    const allowance = resolveAllowance(config);
    const dots = strokesForHoles(playingHandicap(handicap, allowance), strokeIndexByHole);

    expect(playingHandicap(handicap, allowance)).toBe(9); // round(10 * 0.9)
    expect(dots.filter((d) => d > 0)).toHaveLength(9);
    expect(dots.reduce((sum, d) => sum + d, 0)).toBe(9);
  });
});
