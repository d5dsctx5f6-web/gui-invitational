// Duo-vs-duo match state: best-net-ball per hole, three independent segments
// (front 9 / back 9 / overall 18), each worth 1 point (halve 1/2).
// PRODUCT_SPEC §2 "Points" / "Rounds & formats".

export type HoleWinner = "A" | "B" | "halved";

export interface DuoHoleNets {
  hole: number; // 1-18
  /** Net scores of the duo's available players on this hole. 0, 1, or 2 entries — count-agnostic. */
  duoANet: number[];
  duoBNet: number[];
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

/** Best (lowest) net ball among a duo's available players. Null if nobody has a score yet. */
function bestBall(nets: number[]): number | null {
  if (nets.length === 0) return null;
  return Math.min(...nets);
}

function resolveHole(duoANet: number[], duoBNet: number[]): HoleWinner | null {
  const a = bestBall(duoANet);
  const b = bestBall(duoBNet);
  if (a === null || b === null) return null;
  if (a < b) return "A";
  if (b < a) return "B";
  return "halved";
}

function computeSegment(
  holes: DuoHoleNets[],
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
    const result = resolveHole(h.duoANet, h.duoBNet);
    if (result === null) continue; // absent duo / not-yet-entered hole — contributes nothing

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

/**
 * Outright holes won per duo (halves excluded) — feeds the standings "total individual
 * holes won" tiebreaker (Addendum A). Reuses the same per-hole resolution as match state.
 */
export function countHolesWon(holes: DuoHoleNets[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const h of holes) {
    const result = resolveHole(h.duoANet, h.duoBNet);
    if (result === "A") a++;
    else if (result === "B") b++;
  }
  return { a, b };
}

const FRONT_9 = Array.from({ length: 9 }, (_, i) => i + 1);
const BACK_9 = Array.from({ length: 9 }, (_, i) => i + 10);
const ALL_18 = Array.from({ length: 18 }, (_, i) => i + 1);

export function computeMatchState(holes: DuoHoleNets[]): MatchState {
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
