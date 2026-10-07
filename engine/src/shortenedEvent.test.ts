import { describe, expect, it } from "vitest";
import { isMatchDecided, isRoundComplete, officialRounds } from "./shortenedEvent";
import { computeMatchState, type DuoHoleScore } from "./matchState";

const PAR = Array(18).fill(4);
/** A match from a hole-result script: A / B = that side wins the hole, H = halved; shorter = in progress. */
function matchFrom(script: string): ReturnType<typeof computeMatchState> {
  const holes: DuoHoleScore[] = PAR.map((par, i) => {
    const c = script[i];
    if (!c) return { hole: i + 1, par, duoAStrokes: null, duoBStrokes: null };
    return {
      hole: i + 1,
      par,
      duoAStrokes: c === "B" ? par + 1 : par,
      duoBStrokes: c === "A" ? par + 1 : par,
    };
  });
  return computeMatchState(holes);
}

describe("isMatchDecided / isRoundComplete (v2: segments decided, early close counts)", () => {
  it("a full 18 holes is decided", () => {
    expect(isMatchDecided(matchFrom("H".repeat(18)))).toBe(true);
  });

  it("a match settled early is decided without 18 holes posted", () => {
    // A wins holes 1-5 (front closed), 6-9 halved, A wins 10-14 (back closed), overall closes too.
    const m = matchFrom("AAAAAHHHH" + "AAAAAHHHH");
    expect(isMatchDecided(m)).toBe(true);
  });

  it("an in-progress match is not decided", () => {
    expect(isMatchDecided(matchFrom("AAAAAAA"))).toBe(false);
    expect(isMatchDecided(matchFrom(""))).toBe(false);
  });

  it("a round is complete only when it has matches and every one is decided", () => {
    const done = matchFrom("A".repeat(18));
    const live = matchFrom("AAA");
    expect(isRoundComplete([done, done, done, done])).toBe(true);
    expect(isRoundComplete([done, done, done])).toBe(true); // short-handed: three decided matches
    expect(isRoundComplete([done, done, live, done])).toBe(false);
    expect(isRoundComplete([])).toBe(false); // no pairings yet
  });
});

describe("officialRounds", () => {
  it("both rounds complete -> the full trip counts, not shortened", () => {
    const result = officialRounds([
      { roundId: "SAT", complete: true },
      { roundId: "SUN", complete: true },
    ]);
    expect(result).toEqual({ roundIds: ["SAT", "SUN"], shortened: false });
  });

  it("Saturday complete, Sunday incomplete -> only Saturday counts, shortened", () => {
    const result = officialRounds([
      { roundId: "SAT", complete: true },
      { roundId: "SUN", complete: false },
    ]);
    expect(result).toEqual({ roundIds: ["SAT"], shortened: true });
  });

  it("stops at the first incomplete round even if a later one is complete", () => {
    // Shouldn't happen chronologically, but the function shouldn't crash or skip ahead.
    const result = officialRounds([
      { roundId: "SAT", complete: false },
      { roundId: "SUN", complete: true },
    ]);
    expect(result).toEqual({ roundIds: [], shortened: true });
  });
});
