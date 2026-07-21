// Shortened-event resolution. PRODUCT_SPEC §2 / Rulebook §7: if Sunday can't be
// completed, the cup and individual title are decided on the standings after the
// last fully completed round. This module only determines *which rounds count* —
// Parts A/B/C's other functions then run over that subset; no logic is duplicated.

export interface RoundParticipant {
  roundId: string;
  playerId: string;
}

export interface HoleScorePresence {
  roundId: string;
  playerId: string;
  hole: number;
}

/**
 * A round is complete when every participating player has a score for every hole
 * (1-18) in that round. "Participating" is caller-supplied (a player absent the whole
 * round was never a participant, so their absence can't block completeness) —
 * count-agnostic, per ARCHITECTURE's principle.
 */
export function isRoundComplete(
  participants: RoundParticipant[],
  scores: HoleScorePresence[],
  roundId: string,
): boolean {
  const roundPlayerIds = participants
    .filter((p) => p.roundId === roundId)
    .map((p) => p.playerId);
  if (roundPlayerIds.length === 0) return false;

  const roundScores = scores.filter((s) => s.roundId === roundId);
  return roundPlayerIds.every((playerId) =>
    Array.from({ length: 18 }, (_, i) => i + 1).every((hole) =>
      roundScores.some((s) => s.playerId === playerId && s.hole === hole),
    ),
  );
}

export interface RoundStatus {
  roundId: string;
  complete: boolean;
}

export interface OfficialRounds {
  roundIds: string[];
  shortened: boolean;
}

/**
 * Given rounds in chronological order, returns the official rounds: every round up
 * to (and including) the last complete one, stopping at the first incomplete round.
 * `shortened` is true whenever any scheduled round didn't make the cut.
 */
export function officialRounds(roundsInOrder: RoundStatus[]): OfficialRounds {
  const roundIds: string[] = [];
  for (const round of roundsInOrder) {
    if (!round.complete) break;
    roundIds.push(round.roundId);
  }
  return { roundIds, shortened: roundIds.length < roundsInOrder.length };
}
