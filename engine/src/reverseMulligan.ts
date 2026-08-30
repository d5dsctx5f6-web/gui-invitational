// Reverse mulligan availability — one per duo per round. PRODUCT_SPEC_V2 §2
// "Reverse mulligan": force the opposing duo to replay their last shot; whatever they make on
// the replay is the score. No two-score rule, no divergent tracking anymore — a scramble
// produces one number per hole, period, so there is no separate "apply the RM" transform: the
// replay result simply overwrites what gets posted to hole_scores.

export interface ReverseMulliganEvent {
  duoId: string;
  roundId: string;
  hole: number;
}

export interface ReverseMulliganStatus {
  available: boolean;
  usedOnHole: number | null;
}

/**
 * A duo's RM status for a round, derived from events alone — no event means available.
 * Keyed by duo + round per SPEC §2 ("each duo gets one reverse mulligan per round").
 */
export function reverseMulliganStatus(
  events: ReverseMulliganEvent[],
  duoId: string,
  roundId: string,
): ReverseMulliganStatus {
  const used = events.find((e) => e.duoId === duoId && e.roundId === roundId);
  return { available: !used, usedOnHole: used?.hole ?? null };
}
