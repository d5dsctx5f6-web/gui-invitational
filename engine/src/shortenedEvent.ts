// Shortened-event resolution. PRODUCT_SPEC §2 / Rulebook §8: if Sunday can't be
// completed, the cup is decided on the standings after the last fully completed round (applied
// only when the commissioner declares the event shortened — seasons.event_shortened). This
// module only determines *which rounds count* —
// Parts A/B/C's other functions then run over that subset; no logic is duplicated.

import type { MatchState } from "./matchState";

/**
 * A match is decided when all three of its segments (front 9, back 9, overall 18) are decided —
 * an early close counts, so a match that was settled on hole 16 is decided without 18 holes posted.
 */
export function isMatchDecided(state: MatchState): boolean {
  return (
    state.front9.status === "closed" &&
    state.back9.status === "closed" &&
    state.overall18.status === "closed"
  );
}

/**
 * A round is complete when it has at least one match and EVERY match in it is decided (Brief 34).
 * This replaces the v1 rule ("every participating player has a score for all 18 holes"), which
 * can't work in v2: scramble scores belong to the duo, and in best ball a picked-up player simply
 * has no row. Count-agnostic: a short-handed round with three matches is complete when those three
 * are decided.
 */
export function isRoundComplete(matchStates: MatchState[]): boolean {
  return matchStates.length > 0 && matchStates.every(isMatchDecided);
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
