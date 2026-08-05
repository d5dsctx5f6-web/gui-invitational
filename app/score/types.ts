export interface ScorecardPlayer {
  id: string;
  name: string;
  /** Strokes received per hole, index 0 = hole 1. */
  dotsByHole: number[];
  /** False means no real index on file yet — dotsByHole is all zeros by design (Brief 18), not
   *  a computed handicap. Surfaced in the UI so that's obvious, not silent. */
  hasIndex: boolean;
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
  /** Brief 29: the mercy rule — gross capped at that hole's par + 4. Unlike breakfast
   *  ball/mulligan, no per-round usage limit. */
  mercyCalled: boolean;
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
  /** This specific matchup's tee time (Brief 17), null if not yet assigned. */
  teeTime: string | null;
  duoA: ScorecardDuo;
  duoB: ScorecardDuo;
  holes: ScorecardHoleMeta[];
  existingScores: ExistingHoleScore[];
  reverseMulligans: ScorecardReverseMulligan[];
}
