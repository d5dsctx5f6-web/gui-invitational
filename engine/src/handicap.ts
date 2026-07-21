// Course handicap conversion + per-hole stroke allocation.
// PRODUCT_SPEC §2 "Handicaps": Index × (Slope ÷ 113) + (Rating − Par), rounded.

export interface TeeSetup {
  rating: number;
  slope: number;
  par: number;
}

export function courseHandicap(index: number, tee: TeeSetup): number {
  return Math.round(index * (tee.slope / 113) + (tee.rating - tee.par));
}

/**
 * Format allowance hook (deferred — PRODUCT_SPEC §5 open item, applied in Brief 3).
 * Until an allowance % is encoded per format, this is the identity: 100% of course handicap.
 */
export function playingHandicap(
  handicap: number,
  allowancePct: number = 1,
): number {
  return Math.round(handicap * allowancePct);
}

/**
 * Allocates strokes across 18 holes by stroke index (lowest SI gets the first stroke).
 * `strokeIndexByHole[i]` is the SI rank (1-18) of hole `i + 1`.
 * Handles handicaps above 18 (every hole gets a base stroke, plus one more on the
 * lowest-SI holes for the remainder) and below zero without throwing.
 */
export function strokesForHoles(
  handicap: number,
  strokeIndexByHole: number[],
): number[] {
  const base = Math.floor(handicap / 18);
  const remainder = handicap - base * 18;

  return strokeIndexByHole.map((strokeIndex) =>
    strokeIndex <= remainder ? base + 1 : base,
  );
}
