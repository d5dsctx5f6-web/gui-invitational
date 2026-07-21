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

export interface ScorecardData {
  matchId: string;
  roundId: string;
  duoA: ScorecardDuo;
  duoB: ScorecardDuo;
  holes: ScorecardHoleMeta[];
  existingScores: ExistingHoleScore[];
}
