import { describe, expect, it } from "vitest";
import { holeBanner, holeTile, viewerSide } from "./holeView";
import { buildMatchHoles, type BestBallRow, type ScrambleRow } from "./scoring";
import { computeMatchState, resolveHoleResults } from "./matchState";
import { segmentLabel } from "./matchStatus";
import { cappedStrokes } from "./mercyCap";

// A = North (n1, n2), B = South (s1, s2). Par 4 on every hole, so Max is 6.
const PAR = Array(18).fill(4);
const NORTH_IDS = ["n1", "n2"];
const A = "duo-north";
const B = "duo-south";

const scrambleHoles = (rows: [number, number, number][]) =>
  buildMatchHoles({
    format: "scramble",
    parByHole: PAR,
    duoAId: A,
    duoBId: B,
    scrambleRows: rows.flatMap<ScrambleRow>(([hole, n, s]) => [
      { duoId: A, hole, strokes: n },
      { duoId: B, hole, strokes: s },
    ]),
  });

// [hole, northP1, northP2, southP1, southP2]  (null = picked up)
const bestBallHoles = (rows: [number, number | null, number | null, number | null, number | null][]) =>
  buildMatchHoles({
    format: "best_ball",
    parByHole: PAR,
    duoAId: A,
    duoBId: B,
    bestBallRows: rows.flatMap<BestBallRow>(([hole, n1, n2, s1, s2]) => {
      const out: BestBallRow[] = [];
      if (n1 !== null) out.push({ duoId: A, playerId: "n1", hole, strokes: n1 });
      if (n2 !== null) out.push({ duoId: A, playerId: "n2", hole, strokes: n2 });
      if (s1 !== null) out.push({ duoId: B, playerId: "s1", hole, strokes: s1 });
      if (s2 !== null) out.push({ duoId: B, playerId: "s2", hole, strokes: s2 });
      return out;
    }),
  });

/** Everything the signed-in player sees for one hole, derived exactly as the scorecard does. */
function view(holes: ReturnType<typeof scrambleHoles>, hole: number, playerId: string) {
  const mySide = viewerSide(NORTH_IDS, playerId);
  const winner = resolveHoleResults(holes)[hole - 1].winner;
  const state = computeMatchState(holes);
  return {
    banner: holeBanner(winner, hole)?.text ?? null,
    tile: holeTile(winner, mySide),
    f9: segmentLabel(state.front9).text,
    overall: segmentLabel(state.overall18).text,
  };
}

describe("viewerSide", () => {
  it("North players are side A, South players are side B", () => {
    expect(viewerSide(NORTH_IDS, "n1")).toBe("A");
    expect(viewerSide(NORTH_IDS, "n2")).toBe("A");
    expect(viewerSide(NORTH_IDS, "s1")).toBe("B");
    expect(viewerSide([ "n1", null ], "n1")).toBe("A"); // a short-handed North duo
  });
});

describe("holeBanner / holeTile primitives", () => {
  it("names the winner, not the viewer", () => {
    expect(holeBanner("A", 3)).toEqual({ text: "North won hole 3", tone: "north" });
    expect(holeBanner("B", 3)).toEqual({ text: "South won hole 3", tone: "south" });
    expect(holeBanner("halved", 3)).toEqual({ text: "Hole 3 halved", tone: "halved" });
    expect(holeBanner(null, 3)).toBeNull();
  });

  it("W when my side won, L when the other side won, H halved, · unposted", () => {
    expect(holeTile("A", "A")).toEqual({ label: "W", tone: "win" });
    expect(holeTile("A", "B")).toEqual({ label: "L", tone: "loss" });
    expect(holeTile("B", "A")).toEqual({ label: "L", tone: "loss" });
    expect(holeTile("B", "B")).toEqual({ label: "W", tone: "win" });
    expect(holeTile("halved", "A")).toEqual({ label: "H", tone: "halved" });
    expect(holeTile("halved", "B")).toEqual({ label: "H", tone: "halved" });
    expect(holeTile(null, "A")).toEqual({ label: "·", tone: "none" });
  });
});

describe("scramble — the lower score wins, seen from BOTH seats", () => {
  // hole 1: North 4 v South 5 -> North wins.  hole 2: North 5 v South 4 -> SOUTH wins.
  // hole 3: North 9 v South 6 on a par 4 -> mercy cap makes it a halve (9 counts as 6).
  const holes = scrambleHoles([[1, 4, 5], [2, 5, 4], [3, 9, 6]]);

  it("hole 1, North wins: banner, header and tile from North's seat", () => {
    const v = view(holes, 1, "n1");
    expect(v.banner).toBe("North won hole 1");
    expect(v.tile).toEqual({ label: "W", tone: "win" });
  });

  it("hole 1, North wins: the SAME banner and header, but an L tile, from South's seat", () => {
    const v = view(holes, 1, "s1");
    expect(v.banner).toBe("North won hole 1");
    expect(v.tile).toEqual({ label: "L", tone: "loss" });
  });

  it("hole 2, South wins: banner names South; tile is L for North and W for South", () => {
    expect(view(holes, 2, "n2").banner).toBe("South won hole 2");
    expect(view(holes, 2, "n2").tile).toEqual({ label: "L", tone: "loss" });
    expect(view(holes, 2, "s2").banner).toBe("South won hole 2");
    expect(view(holes, 2, "s2").tile).toEqual({ label: "W", tone: "win" });
  });

  it("hole 3, mercy-cap halve: raw 9 v 6 is a halve for both seats", () => {
    expect(cappedStrokes(9, 4)).toBe(6); // proves the cap is what produced the halve
    for (const p of ["n1", "s1"]) {
      const v = view(holes, 3, p);
      expect(v.banner).toBe("Hole 3 halved");
      expect(v.tile).toEqual({ label: "H", tone: "halved" });
    }
  });

  it("the N/S header agrees with every seat: N 1 UP, then all square, then still all square", () => {
    const afterHole1 = scrambleHoles([[1, 4, 5]]);
    expect(view(afterHole1, 1, "n1").f9).toBe("N 1 UP");
    expect(view(afterHole1, 1, "s1").f9).toBe("N 1 UP");
    expect(view(afterHole1, 1, "n1").overall).toBe("N 1 UP");
    const afterHole2 = scrambleHoles([[1, 4, 5], [2, 5, 4]]);
    expect(view(afterHole2, 2, "n1").f9).toBe("AS");
    expect(view(holes, 3, "s2").f9).toBe("AS");
  });

  it("when South leads the header says S n UP from either seat", () => {
    const southUp = scrambleHoles([[1, 5, 4], [2, 6, 4]]);
    expect(view(southUp, 2, "n1").f9).toBe("S 2 UP");
    expect(view(southUp, 2, "s1").f9).toBe("S 2 UP");
  });
});

describe("best ball — the lower BALL wins, seen from BOTH seats", () => {
  // hole 1: North 4,5 (counts 4) v South 5,6 (counts 5) -> North wins.
  // hole 2: North 6,5 (counts 5) v South 4, picked up -> South wins (a blank partner doesn't matter).
  // hole 3: North 8,9 (counts 8) v South 7,8 (counts 7) -> both above Max 6 -> cap halves it.
  const holes = bestBallHoles([[1, 4, 5, 5, 6], [2, 6, 5, 4, null], [3, 8, 9, 7, 8]]);

  it("hole 1, North wins from both seats", () => {
    expect(view(holes, 1, "n1")).toMatchObject({ banner: "North won hole 1", tile: { label: "W" } });
    expect(view(holes, 1, "s2")).toMatchObject({ banner: "North won hole 1", tile: { label: "L" } });
  });

  it("hole 2, South wins (with a picked-up partner) from both seats", () => {
    expect(view(holes, 2, "n1")).toMatchObject({ banner: "South won hole 2", tile: { label: "L" } });
    expect(view(holes, 2, "s1")).toMatchObject({ banner: "South won hole 2", tile: { label: "W" } });
  });

  it("hole 3, both balls above Max: mercy-cap halve from both seats", () => {
    for (const p of ["n2", "s2"]) {
      expect(view(holes, 3, p)).toMatchObject({ banner: "Hole 3 halved", tile: { label: "H" } });
    }
  });

  it("the header tracks the whole match: N 1 UP after hole 1, all square after three", () => {
    const afterHole1 = bestBallHoles([[1, 4, 5, 5, 6]]);
    expect(view(afterHole1, 1, "n1").f9).toBe("N 1 UP");
    expect(view(afterHole1, 1, "s2").f9).toBe("N 1 UP");
    expect(view(holes, 3, "n1").f9).toBe("AS");
    expect(view(holes, 3, "s1").f9).toBe("AS");
  });
});

describe("a flipped side would be caught", () => {
  it("swapping which duo is A changes every output (so these tests would fail)", () => {
    const rows: [number, number, number][] = [[1, 4, 5]];
    const right = scrambleHoles(rows);
    const flipped = buildMatchHoles({
      format: "scramble",
      parByHole: PAR,
      duoAId: B, // South wrongly passed as A
      duoBId: A,
      scrambleRows: [
        { duoId: A, hole: 1, strokes: 4 },
        { duoId: B, hole: 1, strokes: 5 },
      ],
    });
    expect(view(right, 1, "n1").banner).toBe("North won hole 1");
    expect(view(flipped, 1, "n1").banner).toBe("South won hole 1"); // the inversion this suite guards against
  });
});
