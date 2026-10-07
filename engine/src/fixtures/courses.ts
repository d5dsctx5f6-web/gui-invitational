// Brief 32 Part A course fixtures, transcribed exactly from the brief's scorecard tables
// (cross-checked across published scorecards; pars agree across every source).

import type { TeeSet, TeeSetExpectations } from "../courseData";

export const OODHAM_GOLD: TeeSet = {
  course: "Talking Stick Golf Club — O'odham",
  tee: "Gold",
  rating: 69.9,
  slope: 119,
  par: 70,
  parByHole: [4, 5, 4, 4, 4, 3, 4, 3, 4, 4, 3, 4, 4, 4, 4, 3, 5, 4],
  yardageByHole: [379, 509, 417, 390, 356, 187, 427, 143, 412, 390, 217, 358, 356, 410, 425, 161, 534, 439],
  strokeIndex: [15, 13, 1, 3, 11, 5, 9, 17, 7, 12, 6, 2, 16, 8, 14, 18, 4, 10],
};

const SAGUARO_PARS = [4, 4, 4, 5, 3, 4, 4, 5, 3, 4, 3, 4, 4, 5, 3, 4, 4, 4];
const SAGUARO_SI = [5, 11, 9, 1, 15, 7, 13, 3, 17, 14, 18, 6, 8, 2, 16, 12, 10, 4];

export const SAGUARO_PURPLE: TeeSet = {
  course: "WeKoPa Golf Club — Saguaro",
  tee: "Purple",
  rating: 70.2,
  slope: 132,
  par: 71,
  parByHole: SAGUARO_PARS,
  yardageByHole: [443, 299, 383, 609, 159, 406, 305, 498, 130, 322, 194, 461, 457, 527, 233, 315, 372, 490],
  strokeIndex: SAGUARO_SI,
};

export const SAGUARO_WHITE: TeeSet = {
  course: "WeKoPa Golf Club — Saguaro",
  tee: "White",
  rating: 68.8,
  slope: 125,
  par: 71,
  parByHole: SAGUARO_PARS,
  yardageByHole: [426, 288, 362, 595, 146, 380, 290, 482, 121, 306, 176, 423, 417, 513, 209, 290, 358, 470],
  strokeIndex: SAGUARO_SI,
};

export const COURSE_FIXTURES: { tee: TeeSet; expected: TeeSetExpectations }[] = [
  { tee: OODHAM_GOLD, expected: { par: 70, totalYards: 6510 } },
  { tee: SAGUARO_PURPLE, expected: { par: 71, totalYards: 6603 } },
  { tee: SAGUARO_WHITE, expected: { par: 71, totalYards: 6252 } },
];
