// Reverse mulligan availability — one per team per round. PRODUCT_SPEC §2
// "Reverse mulligan". The two-score rule itself is just reading the right source
// (matchScore vs realScore, in netScore.ts) at the right call site — there is no
// separate "apply the RM" transform, because hole_scores.match_strokes already
// carries the divergence.

export interface ReverseMulliganEvent {
  teamId: string;
  roundId: string;
  hole: number;
}

export interface ReverseMulliganStatus {
  available: boolean;
  usedOnHole: number | null;
}

/**
 * A team's RM status for a round, derived from events alone — no event means available.
 * Keyed by team + round (not by match), so it's the same live value in both of that
 * team's foursomes, per SPEC §2.
 */
export function reverseMulliganStatus(
  events: ReverseMulliganEvent[],
  teamId: string,
  roundId: string,
): ReverseMulliganStatus {
  const used = events.find(
    (e) => e.teamId === teamId && e.roundId === roundId,
  );
  return { available: !used, usedOnHole: used?.hole ?? null };
}
