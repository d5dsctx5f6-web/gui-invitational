// Duo-vs-duo match state: one raw score per duo per hole (a scramble has one ball), three
// independent segments (front 9 / back 9 / overall 18), each worth 1 point (halve 1/2).
// PRODUCT_SPEC_V2 §2 "Points" / "Rounds & format". Segment shape (front/back/overall,
// 1pt/½pt each, early-close detection) is unchanged from v1.0 — only the per-hole comparison
// changed, from "best net ball among a duo's available players" to "this duo's one score,
// mercy-capped" (Brief 31 Part B).

import { cappedStrokes } from "./mercyCap";

export type HoleWinner = "A" | "B" | "halved";

export interface DuoHoleScore {
  hole: number; // 1-18
  par: number;
  /** Raw strokes for this duo on this hole, uncapped. Null = not yet posted — count-agnostic:
   *  an absence, never a crash or a zero. The mercy cap is applied here, never stored. */
  duoAStrokes: number | null;
  duoBStrokes: number | null;
}

export interface SegmentState {
  status: "in_progress" | "closed";
  /** Signed holes-up: positive favors duo A, negative favors duo B. */
  holesUp: number;
  /** Holes actually resolved so far within this segment. */
  thru: number;
  winner: HoleWinner | null;
  points: { a: number; b: number };
}

export interface MatchState {
  front9: SegmentState;
  back9: SegmentState;
  overall18: SegmentState;
  totalPoints: { a: number; b: number };
}

function resolveHole(h: DuoHoleScore): HoleWinner | null {
  if (h.duoAStrokes === null || h.duoBStrokes === null) return null;
  const a = cappedStrokes(h.duoAStrokes, h.par);
  const b = cappedStrokes(h.duoBStrokes, h.par);
  if (a < b) return "A";
  if (b < a) return "B";
  return "halved";
}

function computeSegment(
  holes: DuoHoleScore[],
  segmentHoleNumbers: number[],
): SegmentState {
  const segmentLength = segmentHoleNumbers.length;
  const relevant = holes
    .filter((h) => segmentHoleNumbers.includes(h.hole))
    .sort((x, y) => x.hole - y.hole);

  let holesUp = 0;
  let thru = 0;
  let closedEarly = false;

  for (const h of relevant) {
    const result = resolveHole(h);
    if (result === null) continue; // not yet posted — contributes nothing

    thru++;
    if (result === "A") holesUp++;
    else if (result === "B") holesUp--;

    const remaining = segmentLength - thru;
    if (Math.abs(holesUp) > remaining) {
      closedEarly = true;
      break;
    }
  }

  const finished = closedEarly || thru === segmentLength;
  let winner: HoleWinner | null = null;
  let points = { a: 0, b: 0 };

  if (finished) {
    if (holesUp > 0) {
      winner = "A";
      points = { a: 1, b: 0 };
    } else if (holesUp < 0) {
      winner = "B";
      points = { a: 0, b: 1 };
    } else {
      winner = "halved";
      points = { a: 0.5, b: 0.5 };
    }
  }

  return { status: finished ? "closed" : "in_progress", holesUp, thru, winner, points };
}

export interface HoleResult {
  hole: number;
  /** Null if the hole isn't resolvable yet (mirrors resolveHole's own null case). */
  winner: HoleWinner | null;
}

/** Per-hole win/loss/halve results, hole order — the same resolveHole() computeSegment()/
 *  countHolesWon() already use internally, just surfaced (unchanged shape since Brief 23). */
export function resolveHoleResults(holes: DuoHoleScore[]): HoleResult[] {
  return holes
    .slice()
    .sort((x, y) => x.hole - y.hole)
    .map((h) => ({ hole: h.hole, winner: resolveHole(h) }));
}

/**
 * Outright holes won per duo (halves excluded) — feeds the standings "total holes won"
 * tiebreaker. Reuses the same per-hole resolution as match state.
 */
export function countHolesWon(holes: DuoHoleScore[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const h of holes) {
    const result = resolveHole(h);
    if (result === "A") a++;
    else if (result === "B") b++;
  }
  return { a, b };
}

const FRONT_9 = Array.from({ length: 9 }, (_, i) => i + 1);
const BACK_9 = Array.from({ length: 9 }, (_, i) => i + 10);
const ALL_18 = Array.from({ length: 18 }, (_, i) => i + 1);

export function computeMatchState(holes: DuoHoleScore[]): MatchState {
  const front9 = computeSegment(holes, FRONT_9);
  const back9 = computeSegment(holes, BACK_9);
  const overall18 = computeSegment(holes, ALL_18);

  return {
    front9,
    back9,
    overall18,
    totalPoints: {
      a: front9.points.a + back9.points.a + overall18.points.a,
      b: front9.points.b + back9.points.b + overall18.points.b,
    },
  };
}
