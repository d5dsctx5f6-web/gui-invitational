// Course/tee data shape + the seed-time assertions from Brief 32 Part A. Pure data checks:
// course data enters the engine as plain fixtures, never from Supabase.
//
// Pars drive the mercy cap (par + 2) and therefore real match results, so a wrong par is the one
// course-data error that can silently change a result. Rating, slope, yardage and stroke index
// are display-only (captain intel) — still checked, but a wrong value can't change a result.

import { cappedStrokes } from "./mercyCap";

export interface TeeSet {
  course: string;
  tee: string;
  rating: number;
  slope: number;
  par: number;
  parByHole: number[]; // 18 values
  yardageByHole: number[]; // 18 values
  strokeIndex: number[]; // 18 values, a permutation of 1-18
}

export interface TeeSetExpectations {
  par: number;
  totalYards: number;
}

/** Returns a list of problems; an empty list means the tee set passes every seed-time assertion. */
export function validateTeeSet(tee: TeeSet, expected: TeeSetExpectations): string[] {
  const problems: string[] = [];
  const label = `${tee.course} / ${tee.tee}`;

  for (const [name, arr] of [
    ["parByHole", tee.parByHole],
    ["yardageByHole", tee.yardageByHole],
    ["strokeIndex", tee.strokeIndex],
  ] as const) {
    if (arr.length !== 18) problems.push(`${label}: ${name} has ${arr.length} holes, expected 18`);
  }

  const parSum = tee.parByHole.reduce((s, n) => s + n, 0);
  if (parSum !== expected.par) problems.push(`${label}: pars sum to ${parSum}, expected ${expected.par}`);
  if (tee.par !== expected.par) problems.push(`${label}: par field is ${tee.par}, expected ${expected.par}`);

  const yardSum = tee.yardageByHole.reduce((s, n) => s + n, 0);
  if (yardSum !== expected.totalYards) {
    problems.push(`${label}: yardages sum to ${yardSum}, expected ${expected.totalYards}`);
  }

  const si = [...tee.strokeIndex].sort((a, b) => a - b);
  if (si.length !== 18 || si.some((n, i) => n !== i + 1)) {
    problems.push(`${label}: stroke index is not a permutation of 1-18`);
  }

  return problems;
}

/** The Max (mercy cap) for every hole: par + 2, the most a hole can ever cost a duo. */
export function maxScoreByHole(parByHole: number[]): number[] {
  return parByHole.map((par) => cappedStrokes(Number.MAX_SAFE_INTEGER, par));
}
