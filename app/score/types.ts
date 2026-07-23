export interface ScorecardPlayer {
  id: string;
  name: string;
  /** Strokes received per hole, index 0 = hole 1. */
  dotsByHole: number[];
}

export interface ScorecardHoleMeta {
  hole: number;
  par: number;
  yardage: number | null;
  strokeIndex: number;
}

export interface ExistingHoleScore {
  playerId: string;
  hole: number;
  strokes: number;
  matchStrokes: number | null;
  breakfastBall: boolean;
  mulligan: boolean;
}

export interface ScorecardDuo {
  teamId: string;
  teamName: string;
  players: ScorecardPlayer[];
}

export interface ScorecardReverseMulligan {
  id: string;
  teamId: string;
  hole: number;
  victimPlayerId: string;
  /** Set only when the reversed shot was already holed — the real score to preserve for
   * skins/individual while match_strokes carries the replay. Null means a simple non-holed
   * reversal: strokes gets overwritten directly, no divergence. */
  originalHoledScore: number | null;
}

export interface ScorecardData {
  matchId: string;
  roundId: string;
  courseName: string;
  format: string;
  date: string;
  duoA: ScorecardDuo;
  duoB: ScorecardDuo;
  holes: ScorecardHoleMeta[];
  existingScores: ExistingHoleScore[];
  reverseMulligans: ScorecardReverseMulligan[];
}
