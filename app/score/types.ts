import type { RoundFormat } from "@/engine/src";

export interface ScorePlayer {
  id: string;
  name: string;
}

/** One duo of the match. Side A is always North Hedges, side B always South Hedges. */
export interface ScoreDuo {
  id: string;
  side: "A" | "B";
  teamName: string;
  matchSlot: number;
  player1: ScorePlayer;
  player2: ScorePlayer | null;
}

export interface ScrambleScoreRow {
  duoId: string;
  hole: number;
  strokes: number;
  teeShotPlayerId: string | null;
  updatedBy: string | null; // player id; null = the commissioner (service role)
  updatedAt: string;
}

export interface BestBallScoreRow {
  duoId: string;
  playerId: string;
  hole: number;
  strokes: number;
  updatedBy: string | null;
  updatedAt: string;
}

export interface MulliganRow {
  id: string;
  duoId: string;
  hole: number;
}

export interface ScoreSnapshot {
  scramble: ScrambleScoreRow[];
  bestBall: BestBallScoreRow[];
  mulligans: MulliganRow[];
}

export interface ScoreData {
  me: ScorePlayer & { isTest: boolean };
  round: {
    id: string;
    roundNumber: number | null;
    format: RoundFormat;
    courseName: string;
    teeName: string | null;
    firstTeeTime: string | null;
    intervalMinutes: number;
  };
  parByHole: number[];
  yardageByHole: (number | null)[];
  duoA: ScoreDuo;
  duoB: ScoreDuo;
  /** The other rounds this player has a duo in, for the round switcher. */
  otherRounds: { id: string; label: string }[];
  initial: ScoreSnapshot;
}
