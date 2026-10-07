import { describe, expect, it } from "vitest";
import { maxScoreByHole, validateTeeSet } from "./courseData";
import { COURSE_FIXTURES, OODHAM_GOLD, SAGUARO_PURPLE, SAGUARO_WHITE } from "./fixtures/courses";
import { cappedStrokes } from "./mercyCap";
import { computeMatchState, type DuoHoleScore } from "./matchState";

describe("course fixtures match Brief 32 Part A", () => {
  it.each(COURSE_FIXTURES)("$tee.course $tee.tee passes every seed-time assertion", ({ tee, expected }) => {
    expect(validateTeeSet(tee, expected)).toEqual([]);
  });

  it("front/back splits match the printed scorecards", () => {
    const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
    expect([sum(OODHAM_GOLD.parByHole.slice(0, 9)), sum(OODHAM_GOLD.parByHole.slice(9))]).toEqual([35, 35]);
    expect([sum(OODHAM_GOLD.yardageByHole.slice(0, 9)), sum(OODHAM_GOLD.yardageByHole.slice(9))]).toEqual([3220, 3290]);
    expect([sum(SAGUARO_PURPLE.parByHole.slice(0, 9)), sum(SAGUARO_PURPLE.parByHole.slice(9))]).toEqual([36, 35]);
    expect([sum(SAGUARO_PURPLE.yardageByHole.slice(0, 9)), sum(SAGUARO_PURPLE.yardageByHole.slice(9))]).toEqual([3232, 3371]);
    expect([sum(SAGUARO_WHITE.yardageByHole.slice(0, 9)), sum(SAGUARO_WHITE.yardageByHole.slice(9))]).toEqual([3090, 3162]);
  });

  it("the validator actually fails on bad data", () => {
    const badPar = { ...OODHAM_GOLD, parByHole: OODHAM_GOLD.parByHole.map((p, i) => (i === 1 ? 4 : p)) };
    expect(validateTeeSet(badPar, { par: 70, totalYards: 6510 })).not.toEqual([]);
    const badSi = { ...OODHAM_GOLD, strokeIndex: OODHAM_GOLD.strokeIndex.map((s, i) => (i === 0 ? 13 : s)) };
    expect(validateTeeSet(badSi, { par: 70, totalYards: 6510 }).join()).toContain("permutation");
    const short = { ...OODHAM_GOLD, parByHole: OODHAM_GOLD.parByHole.slice(0, 17) };
    expect(validateTeeSet(short, { par: 70, totalYards: 6510 }).join()).toContain("expected 18");
  });
});

describe("Max (mercy cap) per hole", () => {
  it("is par + 2 on every hole of every tee set", () => {
    for (const { tee } of COURSE_FIXTURES) {
      const max = maxScoreByHole(tee.parByHole);
      expect(max).toEqual(tee.parByHole.map((p) => p + 2));
      tee.parByHole.forEach((par, i) => expect(cappedStrokes(99, par)).toBe(max[i]));
    }
  });

  it("spot checks: O'odham hole 2 (par 5 -> 7), Saguaro hole 9 (par 3 -> 5)", () => {
    expect(OODHAM_GOLD.parByHole[1]).toBe(5);
    expect(maxScoreByHole(OODHAM_GOLD.parByHole)[1]).toBe(7);
    expect(SAGUARO_PURPLE.parByHole[8]).toBe(3);
    expect(maxScoreByHole(SAGUARO_PURPLE.parByHole)[8]).toBe(5);
    expect(maxScoreByHole(SAGUARO_WHITE.parByHole)[8]).toBe(5);
  });
});

describe("Saguaro tee switch is display-only", () => {
  const strokesA = [4, 6, 5, 7, 3, 4, 4, 5, 9, 4, 3, 6, 4, 5, 3, 4, 4, 4];
  const strokesB = [5, 4, 4, 6, 3, 5, 4, 5, 4, 4, 4, 5, 4, 5, 4, 4, 5, 4];
  const holesFor = (par: number[]): DuoHoleScore[] =>
    par.map((p, i) => ({ hole: i + 1, par: p, duoAStrokes: strokesA[i], duoBStrokes: strokesB[i] }));

  it("has identical per-hole pars and stroke index on both tees", () => {
    expect(SAGUARO_PURPLE.parByHole).toEqual(SAGUARO_WHITE.parByHole);
    expect(SAGUARO_PURPLE.strokeIndex).toEqual(SAGUARO_WHITE.strokeIndex);
  });

  it("identical duo scores produce identical match state under Purple and White", () => {
    const purple = computeMatchState(holesFor(SAGUARO_PURPLE.parByHole));
    const white = computeMatchState(holesFor(SAGUARO_WHITE.parByHole));
    expect(white).toEqual(purple);
    // the data is non-trivial: the 9 on hole 9 is capped, and the match actually has a result
    expect(purple.totalPoints.a + purple.totalPoints.b).toBeGreaterThan(0);
  });
});
