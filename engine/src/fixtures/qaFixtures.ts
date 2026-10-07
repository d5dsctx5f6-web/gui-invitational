// Brief 33 Part C: the two pinned QA fixtures, both on O'odham Gold's REAL pars. The same data
// drives the tests (with hand-derived expected results) and Admin -> QA sandbox -> Autofill, so a
// result on the phone and a result in the test suite can't drift apart.
//
// Duo A = North (QA North 1 + 2), duo B = South (QA South 1 + 2).

import { OODHAM_GOLD } from "./courses";

export const QA_PAR_BY_HOLE = OODHAM_GOLD.parByHole;

/** Hole 1..18, side A or B, raw strokes; `teeShot` = which partner's drive was used (1 or 2). */
export interface ScrambleFixtureRow {
  hole: number;
  a: number;
  b: number;
  teeShotA?: 1 | 2;
  teeShotB?: 1 | 2;
}

export interface BestBallFixtureRow {
  hole: number;
  /** [player1, player2] raw strokes; null = picked up (blank). */
  a: [number | null, number | null];
  b: [number | null, number | null];
}

export interface FixtureReverseMulligan {
  side: "A" | "B";
  hole: number;
}

export interface FixtureExpectation {
  front9: { winner: "A" | "B" | "halved"; closed: boolean };
  back9: { winner: "A" | "B" | "halved"; closed: boolean };
  overall18: { winner: "A" | "B" | "halved"; closed: boolean };
  points: { a: number; b: number };
}

// ---- Scramble -------------------------------------------------------------------------------
// Hole 7 (par 4, Max 6): A makes 9, B makes 6. Raw, A loses the hole; capped, it's 6 v 6 -> halved.
// Back 9 closes early (N 3 up with 2 to play after hole 16); the overall 18 closes the same hole.
export const SCRAMBLE_FIXTURE: ScrambleFixtureRow[] = [
  { hole: 1, a: 4, b: 5, teeShotA: 1, teeShotB: 2 },
  { hole: 2, a: 6, b: 6, teeShotA: 2 },
  { hole: 3, a: 5, b: 4, teeShotB: 1 },
  { hole: 4, a: 4, b: 4, teeShotA: 1, teeShotB: 1 },
  { hole: 5, a: 4, b: 5 },
  { hole: 6, a: 3, b: 4, teeShotA: 2, teeShotB: 2 },
  { hole: 7, a: 9, b: 6, teeShotA: 1 },
  { hole: 8, a: 4, b: 3, teeShotB: 2 },
  { hole: 9, a: 5, b: 4 },
  { hole: 10, a: 4, b: 5, teeShotA: 1, teeShotB: 1 },
  { hole: 11, a: 3, b: 3, teeShotA: 2 },
  { hole: 12, a: 4, b: 5 },
  { hole: 13, a: 4, b: 4, teeShotB: 2 },
  { hole: 14, a: 5, b: 4, teeShotA: 1 },
  { hole: 15, a: 4, b: 5 },
  { hole: 16, a: 3, b: 4, teeShotA: 2, teeShotB: 1 },
  { hole: 17, a: 5, b: 5 },
  { hole: 18, a: 4, b: 5 },
];
/** South calls its one reverse mulligan on hole 11. */
export const SCRAMBLE_FIXTURE_REVERSE_MULLIGANS: FixtureReverseMulligan[] = [{ side: "B", hole: 11 }];
export const SCRAMBLE_FIXTURE_EXPECTED: FixtureExpectation = {
  front9: { winner: "halved", closed: true },
  back9: { winner: "A", closed: true },
  overall18: { winner: "A", closed: true },
  points: { a: 2.5, b: 0.5 },
};

// ---- Best ball ------------------------------------------------------------------------------
// Differing partner scores throughout (the lower counts); hole 2 has A's player 2 picked up and
// hole 5 has B's player 2 picked up; hole 7 (par 4, Max 6) has BOTH balls above Max on both sides
// (A 8/9, B 7/8): raw B wins (7 v 8), capped it's 6 v 6 -> halved. Back 9 halved.
export const BEST_BALL_FIXTURE: BestBallFixtureRow[] = [
  { hole: 1, a: [5, 6], b: [4, 5] },
  { hole: 2, a: [5, null], b: [5, 7] },
  { hole: 3, a: [6, 4], b: [4, 4] },
  { hole: 4, a: [5, 5], b: [4, 5] },
  { hole: 5, a: [4, 4], b: [5, null] },
  { hole: 6, a: [4, 3], b: [3, 5] },
  { hole: 7, a: [8, 9], b: [7, 8] },
  { hole: 8, a: [3, 4], b: [4, 4] },
  { hole: 9, a: [5, 5], b: [4, 4] },
  { hole: 10, a: [5, 4], b: [4, 5] },
  { hole: 11, a: [3, 4], b: [4, 4] },
  { hole: 12, a: [4, 5], b: [4, 4] },
  { hole: 13, a: [5, 5], b: [4, 5] },
  { hole: 14, a: [4, null], b: [5, 5] },
  { hole: 15, a: [5, 5], b: [4, 5] },
  { hole: 16, a: [3, 4], b: [3, 3] },
  { hole: 17, a: [5, 6], b: [6, 5] },
  { hole: 18, a: [4, 4], b: [4, 4] },
];
/** North calls its one reverse mulligan on hole 11. */
export const BEST_BALL_FIXTURE_REVERSE_MULLIGANS: FixtureReverseMulligan[] = [{ side: "A", hole: 11 }];
export const BEST_BALL_FIXTURE_EXPECTED: FixtureExpectation = {
  front9: { winner: "B", closed: true },
  back9: { winner: "halved", closed: true },
  overall18: { winner: "B", closed: true },
  points: { a: 0.5, b: 2.5 },
};
