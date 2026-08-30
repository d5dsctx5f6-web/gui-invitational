import { describe, expect, it } from "vitest";
import {
  computeMatchState,
  countHolesWon,
  resolveHoleResults,
  type DuoHoleScore,
  type HoleWinner,
} from "./matchState";

const PAR = 4;

/** Single-score-per-duo shorthand: encodes a hole result as two raw strokes, 3 beats 4. */
function hole(holeNumber: number, result: HoleWinner, par = PAR): DuoHoleScore {
  if (result === "A") return { hole: holeNumber, par, duoAStrokes: par - 1, duoBStrokes: par };
  if (result === "B") return { hole: holeNumber, par, duoAStrokes: par, duoBStrokes: par - 1 };
  return { hole: holeNumber, par, duoAStrokes: par, duoBStrokes: par };
}

function holes(results: HoleWinner[]): DuoHoleScore[] {
  return results.map((result, i) => hole(i + 1, result));
}

describe("computeMatchState", () => {
  it("computes correct F9/B9/18 results for a full 18-hole match", () => {
    // Front 9 alternates starting A (5 A, 4 B) -> A 1up.
    // Back 9 alternates starting B (5 B, 4 A) -> B 1up.
    // Overall 18 is the two halves combined -> 9 A wins, 9 B wins -> halved.
    const results: HoleWinner[] = [
      "A", "B", "A", "B", "A", "B", "A", "B", "A",
      "B", "A", "B", "A", "B", "A", "B", "A", "B",
    ];
    const state = computeMatchState(holes(results));

    expect(state.front9).toMatchObject({
      status: "closed",
      thru: 9,
      holesUp: 1,
      winner: "A",
      points: { a: 1, b: 0 },
    });
    expect(state.back9).toMatchObject({
      status: "closed",
      thru: 9,
      holesUp: -1,
      winner: "B",
      points: { a: 0, b: 1 },
    });
    expect(state.overall18).toMatchObject({
      status: "closed",
      thru: 18,
      holesUp: 0,
      winner: "halved",
      points: { a: 0.5, b: 0.5 },
    });
    expect(state.totalPoints).toEqual({ a: 1.5, b: 1.5 });
  });

  it("closes a segment early once it's mathematically decided (6up with 4 to play)", () => {
    const results: HoleWinner[] = [
      "A", "B", "A", "B", "A", "B", "A", "B",
      "A", "A", "A", "A", "A", "A",
      "halved", "halved", "halved", "halved",
    ];
    const state = computeMatchState(holes(results));

    expect(state.overall18.status).toBe("closed");
    expect(state.overall18.thru).toBe(14);
    expect(state.overall18.holesUp).toBe(6);
    expect(state.overall18.winner).toBe("A");
    expect(state.overall18.points).toEqual({ a: 1, b: 0 });
  });

  it("halves an all-square segment", () => {
    const results: HoleWinner[] = [
      "A", "A", "A", "A", "A", "A", "A", "A", "A",
      "halved", "halved", "halved", "halved", "halved", "halved", "halved", "halved", "halved",
    ];
    const state = computeMatchState(holes(results));

    expect(state.back9).toMatchObject({
      status: "closed",
      thru: 9,
      holesUp: 0,
      winner: "halved",
      points: { a: 0.5, b: 0.5 },
    });
  });

  it("count-agnostic: a hole not yet posted for either duo is skipped, not corrupted into a loss", () => {
    const state = computeMatchState([
      { hole: 1, par: PAR, duoAStrokes: null, duoBStrokes: null },
      { hole: 2, par: PAR, duoAStrokes: 3, duoBStrokes: 4 },
    ]);

    expect(state.front9.thru).toBe(1);
    expect(state.front9.holesUp).toBe(1);
    expect(state.front9.status).toBe("in_progress");
  });

  it("count-agnostic: only one side posted is also unresolved, not a default loss for the other", () => {
    const state = computeMatchState([{ hole: 1, par: PAR, duoAStrokes: 3, duoBStrokes: null }]);
    expect(state.front9.thru).toBe(0);
    expect(state.front9.status).toBe("in_progress");
  });

  it("mercy cap: a duo score above par+2 is capped for match purposes, raw input untouched", () => {
    // Par 4 hole: duo A blows up to a raw 9 (capped to 6), duo B makes a 6 -> capped, A(6) and
    // B(6) are dead even; uncapped, A's raw 9 would lose outright. Proves both the cap applies
    // and that computeMatchState never mutates the input array (store-raw-derive-everything).
    // resolveHoleResults, not the whole segment, since a single hole never closes a 9-hole
    // segment on its own (see the count-agnostic in-progress tests above).
    const input: DuoHoleScore[] = [{ hole: 1, par: 4, duoAStrokes: 9, duoBStrokes: 6 }];
    const snapshot = JSON.parse(JSON.stringify(input));

    expect(resolveHoleResults(input)).toEqual([{ hole: 1, winner: "halved" }]);
    expect(input).toEqual(snapshot);
    expect(input[0].duoAStrokes).toBe(9);
  });

  it("the cap has a real ceiling — it limits the damage but never turns a genuine loss into a win", () => {
    // Par 4: A raw 7 (over the cap, capped to 6) vs B raw 5 (under the cap, untouched). B's
    // real 5 still beats A's capped 6 -- the cap softens how bad A's exposure is, it doesn't
    // erase a hole B legitimately won outright.
    const result = resolveHoleResults([{ hole: 1, par: 4, duoAStrokes: 7, duoBStrokes: 5 }]);
    expect(result).toEqual([{ hole: 1, winner: "B" }]);
  });
});

describe("resolveHoleResults", () => {
  it("returns the same per-hole winner computeMatchState already resolves internally", () => {
    const results: HoleWinner[] = ["A", "B", "halved", "A"];
    expect(resolveHoleResults(holes(results))).toEqual([
      { hole: 1, winner: "A" },
      { hole: 2, winner: "B" },
      { hole: 3, winner: "halved" },
      { hole: 4, winner: "A" },
    ]);
  });

  it("a hole with no scores yet resolves to a null winner, not a crash", () => {
    expect(
      resolveHoleResults([{ hole: 1, par: PAR, duoAStrokes: null, duoBStrokes: null }]),
    ).toEqual([{ hole: 1, winner: null }]);
  });

  it("returns results in hole order regardless of input order", () => {
    const outOfOrder: DuoHoleScore[] = [
      { hole: 3, par: PAR, duoAStrokes: 3, duoBStrokes: 4 },
      { hole: 1, par: PAR, duoAStrokes: 4, duoBStrokes: 3 },
      { hole: 2, par: PAR, duoAStrokes: 4, duoBStrokes: 4 },
    ];
    expect(resolveHoleResults(outOfOrder).map((r) => r.hole)).toEqual([1, 2, 3]);
  });
});

describe("countHolesWon", () => {
  it("counts outright wins per duo, excluding halves", () => {
    const results: HoleWinner[] = ["A", "A", "B", "halved", "A"];
    expect(countHolesWon(holes(results))).toEqual({ a: 3, b: 1 });
  });

  it("returns zero for both when every hole is halved or unresolved", () => {
    expect(countHolesWon(holes(["halved", "halved"]))).toEqual({ a: 0, b: 0 });
    expect(
      countHolesWon([{ hole: 1, par: PAR, duoAStrokes: null, duoBStrokes: null }]),
    ).toEqual({ a: 0, b: 0 });
  });
});
