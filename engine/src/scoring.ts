// Brief 33: feeds both formats into the ONE match-state implementation (computeMatchState /
// resolveHoleResults) through a single adapter. There is no second match-state code path.
//
//   scramble:  one raw score per duo per hole -> passes through unchanged
//   best ball: player rows -> per-duo LOWEST RAW score per hole -> the same duo-score shape
//
// The mercy cap stays inside the engine (computeMatchState caps each duo's score). For best ball
// that is exactly equivalent to capping each ball first, because
//   min(cap(a), cap(b)) = cap(min(a, b))      (cap(x) = min(x, par + 2) is monotone)
// so taking the lower raw score and capping it once gives the same answer. Raw numbers are always
// stored and returned as entered.

import type { DuoHoleScore } from "./matchState";

export type RoundFormat = "scramble" | "best_ball";

export interface ScrambleRow {
  duoId: string;
  hole: number;
  strokes: number;
}

export interface BestBallRow {
  duoId: string;
  playerId: string;
  hole: number;
  strokes: number;
}

/** The duo's best-ball hole score: the lowest RAW score among the players who posted one.
 *  Null / undefined entries are picked-up players (blank). Null when nobody posted. */
export function bestBallDuoStrokes(strokes: (number | null | undefined)[]): number | null {
  const posted = strokes.filter((s): s is number => typeof s === "number");
  return posted.length === 0 ? null : Math.min(...posted);
}

/** Which players' balls counted for a hole (everyone tied on the lowest raw score). */
export function countingPlayerIds(byPlayer: Record<string, number | null | undefined>): string[] {
  const best = bestBallDuoStrokes(Object.values(byPlayer));
  if (best === null) return [];
  return Object.entries(byPlayer)
    .filter(([, s]) => s === best)
    .map(([id]) => id);
}

export interface BuildMatchHolesInput {
  format: RoundFormat;
  /** Par for holes 1-18 (index 0 = hole 1). */
  parByHole: number[];
  duoAId: string;
  duoBId: string;
  scrambleRows?: ScrambleRow[];
  bestBallRows?: BestBallRow[];
}

/** All 18 holes of a match in the shape computeMatchState expects. Unposted = null. */
export function buildMatchHoles(input: BuildMatchHolesInput): DuoHoleScore[] {
  const { format, parByHole, duoAId, duoBId } = input;

  const duoStrokes = (duoId: string, hole: number): number | null => {
    if (format === "scramble") {
      const row = (input.scrambleRows ?? []).find((r) => r.duoId === duoId && r.hole === hole);
      return row ? row.strokes : null;
    }
    return bestBallDuoStrokes(
      (input.bestBallRows ?? [])
        .filter((r) => r.duoId === duoId && r.hole === hole)
        .map((r) => r.strokes),
    );
  };

  return parByHole.map((par, i) => ({
    hole: i + 1,
    par,
    duoAStrokes: duoStrokes(duoAId, i + 1),
    duoBStrokes: duoStrokes(duoBId, i + 1),
  }));
}

/** Holes (1-18) that have a posted score for BOTH duos (a hole is "posted" once both sides count). */
export function postedHoles(holes: DuoHoleScore[]): number[] {
  return holes.filter((h) => h.duoAStrokes !== null && h.duoBStrokes !== null).map((h) => h.hole);
}

/** First hole (1-18) not yet posted, or null when all 18 are in. */
export function nextUnpostedHole(posted: number[]): number | null {
  for (let h = 1; h <= 18; h++) if (!posted.includes(h)) return h;
  return null;
}
