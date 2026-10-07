import { describe, expect, it } from "vitest";
import {
  bestBallDuoStrokes,
  buildMatchHoles,
  countingPlayerIds,
  nextUnpostedHole,
  postedHoles,
  type BestBallRow,
  type ScrambleRow,
} from "./scoring";
import { cappedStrokes } from "./mercyCap";
import { computeMatchState, resolveHoleResults } from "./matchState";
import { liveNote, segmentLabel, formatPoints } from "./matchStatus";
import {
  BEST_BALL_FIXTURE,
  BEST_BALL_FIXTURE_EXPECTED,
  BEST_BALL_FIXTURE_REVERSE_MULLIGANS,
  QA_PAR_BY_HOLE,
  SCRAMBLE_FIXTURE,
  SCRAMBLE_FIXTURE_EXPECTED,
  SCRAMBLE_FIXTURE_REVERSE_MULLIGANS,
  type FixtureExpectation,
} from "./fixtures/qaFixtures";
import { reverseMulliganStatus } from "./reverseMulligan";

const A = "duo-north";
const B = "duo-south";

function scrambleRows(): ScrambleRow[] {
  return SCRAMBLE_FIXTURE.flatMap((r) => [
    { duoId: A, hole: r.hole, strokes: r.a },
    { duoId: B, hole: r.hole, strokes: r.b },
  ]);
}

function bestBallRows(): BestBallRow[] {
  const rows: BestBallRow[] = [];
  for (const r of BEST_BALL_FIXTURE) {
    r.a.forEach((s, i) => s !== null && rows.push({ duoId: A, playerId: `n${i + 1}`, hole: r.hole, strokes: s }));
    r.b.forEach((s, i) => s !== null && rows.push({ duoId: B, playerId: `s${i + 1}`, hole: r.hole, strokes: s }));
  }
  return rows;
}

function check(expected: FixtureExpectation, state: ReturnType<typeof computeMatchState>) {
  for (const seg of ["front9", "back9", "overall18"] as const) {
    expect(state[seg].winner).toBe(expected[seg].winner);
    expect(state[seg].status === "closed").toBe(expected[seg].closed);
  }
  expect(state.totalPoints).toEqual(expected.points);
}

describe("QA fixtures (pinned) — O'odham Gold real pars", () => {
  it("scramble fixture → pinned segment winners and 2.5–0.5 points", () => {
    const holes = buildMatchHoles({ format: "scramble", parByHole: QA_PAR_BY_HOLE, duoAId: A, duoBId: B, scrambleRows: scrambleRows() });
    check(SCRAMBLE_FIXTURE_EXPECTED, computeMatchState(holes));
  });

  it("scramble fixture exercises the cap, a halved segment and a reverse mulligan", () => {
    const holes = buildMatchHoles({ format: "scramble", parByHole: QA_PAR_BY_HOLE, duoAId: A, duoBId: B, scrambleRows: scrambleRows() });
    // hole 7: par 4, A makes 9 vs B's 6. Raw A loses; capped (Max 6) it is a halve.
    const h7 = holes[6];
    expect(h7.par).toBe(4);
    expect(h7.duoAStrokes).toBe(9); // stored raw
    expect(cappedStrokes(9, h7.par)).toBe(6);
    expect(resolveHoleResults(holes)[6].winner).toBe("halved");
    expect(h7.duoAStrokes! > h7.duoBStrokes!).toBe(true); // proves the cap is what changed the result
    // front 9 is a halved segment
    expect(computeMatchState(holes).front9.winner).toBe("halved");
    // a reverse mulligan is logged on hole 11: South used, North still available
    const events = SCRAMBLE_FIXTURE_REVERSE_MULLIGANS.map((m) => ({ duoId: m.side === "A" ? A : B, roundId: "r1", hole: m.hole }));
    expect(reverseMulliganStatus(events, B, "r1")).toEqual({ available: false, usedOnHole: 11 });
    expect(reverseMulliganStatus(events, A, "r1")).toEqual({ available: true, usedOnHole: null });
  });

  it("best-ball fixture → pinned segment winners and 0.5–2.5 points", () => {
    const holes = buildMatchHoles({ format: "best_ball", parByHole: QA_PAR_BY_HOLE, duoAId: A, duoBId: B, bestBallRows: bestBallRows() });
    check(BEST_BALL_FIXTURE_EXPECTED, computeMatchState(holes));
  });

  it("best-ball fixture exercises: lower ball counts, picked-up players, both balls above Max, a halved segment, a mulligan", () => {
    const holes = buildMatchHoles({ format: "best_ball", parByHole: QA_PAR_BY_HOLE, duoAId: A, duoBId: B, bestBallRows: bestBallRows() });
    expect(holes[0].duoAStrokes).toBe(5); // partners made 5 and 6 → the 5 counts
    expect(holes[1].duoAStrokes).toBe(5); // player 2 picked up → player 1's 5 counts
    expect(holes[4].duoBStrokes).toBe(5); // South's player 2 picked up
    // hole 7: all four balls above Max (8,9 v 7,8). Raw B wins; capped 6 v 6 halves it.
    expect(holes[6].duoAStrokes).toBe(8);
    expect(holes[6].duoBStrokes).toBe(7);
    expect(resolveHoleResults(holes)[6].winner).toBe("halved");
    expect(computeMatchState(holes).back9.winner).toBe("halved");
    const events = BEST_BALL_FIXTURE_REVERSE_MULLIGANS.map((m) => ({ duoId: m.side === "A" ? A : B, roundId: "r2", hole: m.hole }));
    expect(reverseMulliganStatus(events, A, "r2").usedOnHole).toBe(11);
  });

  it("the two fixtures give different results, so a format mix-up can't hide", () => {
    expect(SCRAMBLE_FIXTURE_EXPECTED.points).not.toEqual(BEST_BALL_FIXTURE_EXPECTED.points);
  });
});

describe("mercy cap equivalence for best ball", () => {
  it("min(cap(a), cap(b)) = cap(min(a, b)) across a sweep of pars and scores", () => {
    for (const par of [3, 4, 5]) {
      for (let a = 1; a <= 15; a++) {
        for (let b = 1; b <= 15; b++) {
          expect(Math.min(cappedStrokes(a, par), cappedStrokes(b, par))).toBe(cappedStrokes(Math.min(a, b), par));
        }
      }
    }
  });

  it("the adapter keeps RAW scores and the engine caps them once (both formats)", () => {
    const scr = buildMatchHoles({ format: "scramble", parByHole: [4], duoAId: A, duoBId: B, scrambleRows: [{ duoId: A, hole: 1, strokes: 9 }, { duoId: B, hole: 1, strokes: 6 }] });
    expect(scr[0].duoAStrokes).toBe(9);
    expect(resolveHoleResults(scr)[0].winner).toBe("halved"); // 9 counts as 6
    const bb = buildMatchHoles({
      format: "best_ball", parByHole: [4], duoAId: A, duoBId: B,
      bestBallRows: [
        { duoId: A, playerId: "n1", hole: 1, strokes: 9 }, { duoId: A, playerId: "n2", hole: 1, strokes: 10 },
        { duoId: B, playerId: "s1", hole: 1, strokes: 6 },
      ],
    });
    expect(bb[0].duoAStrokes).toBe(9); // lowest RAW
    expect(resolveHoleResults(bb)[0].winner).toBe("halved");
  });
});

describe("best ball edge cases", () => {
  it("lowest raw score counts; blanks are ignored; nobody posted = null", () => {
    expect(bestBallDuoStrokes([5, 4])).toBe(4);
    expect(bestBallDuoStrokes([null, 6])).toBe(6);
    expect(bestBallDuoStrokes([undefined, null])).toBeNull();
    expect(bestBallDuoStrokes([])).toBeNull();
  });

  it("marks every tied counting ball", () => {
    expect(countingPlayerIds({ n1: 4, n2: 5 })).toEqual(["n1"]);
    expect(countingPlayerIds({ n1: 4, n2: 4 })).toEqual(["n1", "n2"]);
    expect(countingPlayerIds({ n1: null, n2: 6 })).toEqual(["n2"]);
    expect(countingPlayerIds({ n1: null, n2: null })).toEqual([]);
  });

  it("a short-handed duo (one player) posts fine; a hole with no scores isn't posted", () => {
    const holes = buildMatchHoles({
      format: "best_ball", parByHole: [4, 4], duoAId: A, duoBId: B,
      bestBallRows: [
        { duoId: A, playerId: "n1", hole: 1, strokes: 4 }, // North has only one player
        { duoId: B, playerId: "s1", hole: 1, strokes: 5 },
        { duoId: B, playerId: "s2", hole: 1, strokes: 6 },
        { duoId: B, playerId: "s1", hole: 2, strokes: 4 },
      ],
    });
    expect(resolveHoleResults(holes)[0].winner).toBe("A");
    expect(holes[1].duoAStrokes).toBeNull();
    expect(resolveHoleResults(holes)[1].winner).toBeNull();
    expect(postedHoles(holes)).toEqual([1]);
  });

  it("nextUnpostedHole advances past posted holes", () => {
    expect(nextUnpostedHole([])).toBe(1);
    expect(nextUnpostedHole([1, 2, 3])).toBe(4);
    expect(nextUnpostedHole([1, 3])).toBe(2);
    expect(nextUnpostedHole(Array.from({ length: 18 }, (_, i) => i + 1))).toBeNull();
  });
});

describe("segment liveness", () => {
  it("overall 18 closed early while the back 9 is still open", () => {
    // North wins holes 1-9 by a lot (front 9 + 9 up), then holes 10-12 are posted halved:
    // overall is closed (>remaining), back 9 still open.
    const holes = buildMatchHoles({
      format: "scramble", parByHole: QA_PAR_BY_HOLE, duoAId: A, duoBId: B,
      scrambleRows: [
        ...Array.from({ length: 9 }, (_, i) => [
          { duoId: A, hole: i + 1, strokes: QA_PAR_BY_HOLE[i] },
          { duoId: B, hole: i + 1, strokes: QA_PAR_BY_HOLE[i] + 1 },
        ]).flat(),
        ...[10, 11, 12].flatMap((h) => [
          { duoId: A, hole: h, strokes: QA_PAR_BY_HOLE[h - 1] },
          { duoId: B, hole: h, strokes: QA_PAR_BY_HOLE[h - 1] },
        ]),
      ],
    });
    const state = computeMatchState(holes);
    expect(state.overall18.status).toBe("closed");
    expect(state.overall18.winner).toBe("A");
    expect(state.back9.status).toBe("in_progress");
    expect(liveNote(state)).toBe("18 decided — back 9 still live");
    expect(segmentLabel(state.back9).text).toBe("AS");
    expect(segmentLabel(state.overall18).text).toBe("✓ N");
  });

  it("no live note when nothing is decided or when everything closed", () => {
    const empty = computeMatchState(buildMatchHoles({ format: "scramble", parByHole: QA_PAR_BY_HOLE, duoAId: A, duoBId: B }));
    expect(liveNote(empty)).toBeNull();
    const done = computeMatchState(buildMatchHoles({ format: "scramble", parByHole: QA_PAR_BY_HOLE, duoAId: A, duoBId: B, scrambleRows: scrambleRows() }));
    expect(liveNote(done)).toBeNull();
  });

  it("status labels: up, all square, decided, halved, nothing yet", () => {
    const base = { status: "in_progress" as const, winner: null, points: { a: 0, b: 0 } };
    expect(segmentLabel({ ...base, holesUp: 2, thru: 4 }).text).toBe("N 2 UP");
    expect(segmentLabel({ ...base, holesUp: -1, thru: 4 }).text).toBe("S 1 UP");
    expect(segmentLabel({ ...base, holesUp: 0, thru: 4 }).text).toBe("AS");
    expect(segmentLabel({ ...base, holesUp: 0, thru: 0 }).text).toBe("—");
    expect(segmentLabel({ status: "closed", holesUp: 0, thru: 9, winner: "halved", points: { a: 0.5, b: 0.5 } }).text).toBe("½");
    expect(segmentLabel({ status: "closed", holesUp: -2, thru: 9, winner: "B", points: { a: 0, b: 1 } }).text).toBe("✓ S");
    expect([formatPoints(0), formatPoints(0.5), formatPoints(2.5), formatPoints(3)]).toEqual(["0", "½", "2½", "3"]);
  });
});
