import { describe, expect, it } from "vitest";
import { computeMatchState, type DuoHoleNets, type HoleWinner } from "./matchState";

/** Single-ball-per-duo shorthand: encodes a hole result as two net scores, 3 beats 4. */
function hole(holeNumber: number, result: HoleWinner): DuoHoleNets {
  if (result === "A") return { hole: holeNumber, duoANet: [3], duoBNet: [4] };
  if (result === "B") return { hole: holeNumber, duoANet: [4], duoBNet: [3] };
  return { hole: holeNumber, duoANet: [4], duoBNet: [4] };
}

function holes(results: HoleWinner[]): DuoHoleNets[] {
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
    // Holes 1-8 alternate (even), holes 9-14 all go to A -> 6up thru 14, 4 left in the 18.
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
      "A", "A", "A", "A", "A", "A", "A", "A", "A", // front9: irrelevant to this assertion
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

  it("count-agnostic: a duo down to one available ball still resolves the hole correctly", () => {
    // Duo A has both players in (net 4 each); Duo B is down to one player (net 3) -> B wins.
    const state = computeMatchState([{ hole: 1, duoANet: [4], duoBNet: [3, 5] }]);

    expect(state.front9).toMatchObject({
      status: "in_progress",
      thru: 1,
      holesUp: -1,
      winner: null,
    });
  });

  it("count-agnostic: a hole with no scores yet is skipped, not corrupted into a loss", () => {
    // Hole 1 unresolved (nobody's ball is in yet), hole 2 decided.
    const state = computeMatchState([
      { hole: 1, duoANet: [], duoBNet: [] },
      { hole: 2, duoANet: [3], duoBNet: [4] },
    ]);

    expect(state.front9.thru).toBe(1);
    expect(state.front9.holesUp).toBe(1);
    expect(state.front9.status).toBe("in_progress");
  });

  it("count-agnostic: a duo short a player for the whole round still produces valid, non-throwing results", () => {
    // Duo A always fields two players (best net 4); Duo B is short a player all round (net 3).
    const shortHandedHoles: DuoHoleNets[] = Array.from({ length: 18 }, (_, i) => ({
      hole: i + 1,
      duoANet: [4, 4],
      duoBNet: [3],
    }));

    expect(() => computeMatchState(shortHandedHoles)).not.toThrow();

    const state = computeMatchState(shortHandedHoles);
    expect(state.front9.status).toBe("closed");
    expect(state.front9.winner).toBe("B");
    expect(state.back9.status).toBe("closed");
    expect(state.back9.winner).toBe("B");
    expect(state.overall18.status).toBe("closed");
    expect(state.overall18.winner).toBe("B");
    expect(state.totalPoints).toEqual({ a: 0, b: 3 });
  });
});
