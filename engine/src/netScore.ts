// Net score per hole. Missing scores are absences, not zeros — callers simply omit
// them rather than passing a sentinel, so there is nothing here to special-case.

export interface HoleScore {
  strokes: number;
  matchStrokes?: number | null;
}

/** The score source for match play: the reverse-mulligan two-score rule reads this. */
export function matchScore(score: HoleScore): number {
  return score.matchStrokes ?? score.strokes;
}

export function netScore(gross: number, strokesReceived: number): number {
  return gross - strokesReceived;
}
